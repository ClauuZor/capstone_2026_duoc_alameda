import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { registrarManejadorNoAutorizado } from "../api/errors";
import type { Usuario } from "../api/types";
import { getToken, msHastaExpirar, setToken, tokenVigente } from "./token";

type Estado = "cargando" | "autenticado" | "anonimo";
export type MotivoSalida = "sesion-expirada" | "manual" | null;

interface ValorAuth {
  estado: Estado;
  usuario: Usuario | null;
  motivoSalida: MotivoSalida;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: (motivo?: MotivoSalida) => void;
}

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [motivoSalida, setMotivoSalida] = useState<MotivoSalida>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  const cerrarSesion = useCallback(
    (motivo: MotivoSalida = "manual") => {
      clearTimeout(temporizador.current);
      setToken(null);
      queryClient.clear(); // no dejar datos de la sesión anterior en caché
      setUsuario(null);
      setMotivoSalida(motivo);
      setEstado("anonimo");
    },
    [queryClient],
  );

  const programarExpiracion = useCallback(
    (token: string) => {
      clearTimeout(temporizador.current);
      // setTimeout no admite más de ~24,8 días; los tokens de acceso duran minutos u horas.
      const ms = Math.min(msHastaExpirar(token), 2_147_000_000);
      temporizador.current = setTimeout(() => cerrarSesion("sesion-expirada"), ms);
    },
    [cerrarSesion],
  );

  useEffect(() => {
    registrarManejadorNoAutorizado(() => cerrarSesion("sesion-expirada"));
    return () => registrarManejadorNoAutorizado(null);
  }, [cerrarSesion]);

  // Restaurar la sesión al recargar la página.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setEstado("anonimo");
      return;
    }
    if (!tokenVigente(token)) {
      cerrarSesion("sesion-expirada");
      return;
    }
    let cancelado = false;
    api
      .me()
      .then((u) => {
        if (cancelado) return;
        setUsuario(u);
        setEstado("autenticado");
        programarExpiracion(token);
      })
      .catch(() => !cancelado && cerrarSesion("sesion-expirada"));
    return () => {
      cancelado = true;
    };
  }, [cerrarSesion, programarExpiracion]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      try {
        const u = await api.me();
        setUsuario(u);
        setMotivoSalida(null);
        setEstado("autenticado");
        programarExpiracion(access_token);
      } catch (e) {
        setToken(null);
        throw e;
      }
    },
    [programarExpiracion],
  );

  const valor = useMemo(() => ({ estado, usuario, motivoSalida, iniciarSesion, cerrarSesion }), [estado, usuario, motivoSalida, iniciarSesion, cerrarSesion]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
