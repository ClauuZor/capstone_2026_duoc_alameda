import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { EstadoCarga } from "../components/Estados";
import { useAuth } from "./AuthContext";

/**
 * Protege las rutas: sin sesión redirige a /login recordando la ruta solicitada.
 * Es una barrera de interfaz; la protección real es que la API exige el token en cada endpoint (401).
 */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const { estado } = useAuth();
  const ubicacion = useLocation();
  if (estado === "cargando") return <EstadoCarga mensaje="Verificando sesión…" pantallaCompleta />;
  if (estado === "anonimo") return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return <>{children}</>;
}
