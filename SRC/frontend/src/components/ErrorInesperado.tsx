import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

/**
 * Se muestra si una pantalla falla al renderizar (un error de programación o datos con una forma
 * que no respeta el contrato). Evita la pantalla en blanco y deja el detalle en la consola.
 */
export function ErrorInesperado() {
  const error = useRouteError();
  console.error(error);
  const detalle = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : null;

  return (
    <main role="alert" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Algo falló al mostrar esta pantalla</h1>
      <p className="mt-2 text-texto-suave">Recarga la página. Si el problema continúa, avisa al equipo con lo que estabas haciendo.</p>
      {detalle && <p className="mt-4 rounded-md bg-hundido px-3 py-2 text-left text-sm break-words text-texto-suave">Detalle técnico: {detalle}</p>}
      <div className="mt-6 flex justify-center gap-4">
        <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-vidrio px-4 py-2 font-semibold text-white hover:bg-vidrio-fuerte dark:text-fondo">
          Recargar
        </button>
        <Link to="/" reloadDocument className="rounded-md px-4 py-2 font-medium text-vidrio hover:bg-vidrio-tenue">
          Ir al resumen
        </Link>
      </div>
    </main>
  );
}
