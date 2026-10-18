import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { config } from "../config";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { Campo, Entrada } from "../components/Controles";
import { useTitulo } from "../hooks/useTitulo";

export function LoginPage() {
  const { estado, iniciarSesion, motivoSalida } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useTitulo("Iniciar sesión");

  if (estado === "autenticado") return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(email, password);
      navegar(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold tracking-tight [font-stretch:125%]">Cotiza+</h1>
        <p className="mt-1 text-texto-suave">Consulta las cotizaciones del taller y sus métricas.</p>

        {motivoSalida === "sesion-expirada" && !error && (
          <p role="status" className="mt-6 rounded-md bg-alerta-tenue px-4 py-3 text-alerta">
            Tu sesión expiró. Inicia sesión nuevamente.
          </p>
        )}

        <form onSubmit={enviar} noValidate className="mt-6 space-y-4 rounded-lg border border-borde bg-superficie p-6">
          <Campo etiqueta="Correo" id="email">
            <Entrada id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo etiqueta="Contraseña" id="password">
            <Entrada id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Campo>
          {error && (
            <p role="alert" className="text-sm font-medium text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-vidrio px-4 py-2.5 font-semibold text-white hover:bg-vidrio-fuerte disabled:opacity-60 dark:text-fondo"
          >
            {enviando ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>

        {config.apiMode === "mock" && (
          <p className="mt-4 text-sm text-texto-suave">
            Modo demostración con datos simulados. Usa <span className="font-medium text-texto">demo@cotiza.test</span> y la contraseña{" "}
            <span className="font-medium text-texto">demo1234</span>.
          </p>
        )}
      </div>
    </main>
  );
}
