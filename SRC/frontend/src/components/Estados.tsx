import type { ReactNode } from "react";

export function EstadoCarga({ mensaje = "Cargando…", pantallaCompleta = false }: { mensaje?: string; pantallaCompleta?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-3 text-texto-suave ${pantallaCompleta ? "min-h-screen justify-center" : "py-16 justify-center"}`}>
      <span className="size-4 rounded-full border-2 border-borde-fuerte border-t-vidrio animate-spin" aria-hidden />
      {mensaje}
    </div>
  );
}

export function EstadoError({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <div role="alert" className="my-6 rounded-md border border-error/40 bg-error-tenue px-5 py-4">
      <p className="font-semibold text-error">No se pudieron cargar los datos</p>
      <p className="mt-1 text-texto">{mensaje}</p>
      {alReintentar && (
        <button type="button" onClick={alReintentar} className="mt-3 rounded-md border border-borde-fuerte bg-superficie px-3 py-1.5 font-medium hover:bg-hundido">
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Con `principal`, el título es el h1 de la página (por ejemplo, en "página no encontrada"). */
export function EstadoVacio({ titulo, descripcion, accion, principal = false }: { titulo: string; descripcion?: string; accion?: ReactNode; principal?: boolean }) {
  const Titulo = principal ? "h1" : "p";
  return (
    <div className="py-16 text-center">
      <Titulo className="text-lg font-semibold">{titulo}</Titulo>
      {descripcion && <p className="mx-auto mt-1 max-w-md text-texto-suave">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
