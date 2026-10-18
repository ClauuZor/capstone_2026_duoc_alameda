import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const enlace = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 font-medium whitespace-nowrap ${isActive ? "bg-vidrio-tenue text-vidrio-fuerte" : "text-texto-suave hover:bg-hundido hover:text-texto"}`;

export function Marco() {
  const { usuario, cerrarSesion } = useAuth();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      {/* El fondo y el borde van en la columna completa; solo el contenido interior queda fijo al hacer scroll. */}
      <aside className="border-b border-borde bg-superficie md:border-r md:border-b-0">
        <div className="flex flex-col gap-4 p-4 md:sticky md:top-0 md:h-screen md:p-5">
          <div className="flex items-center justify-between md:block">
            <p className="text-xl font-bold tracking-tight [font-stretch:125%]">Cotiza+</p>
            <p className="hidden text-sm text-texto-suave md:mt-0.5 md:block">Cotizaciones del taller</p>
            <button type="button" onClick={() => cerrarSesion()} className="text-sm font-medium text-texto-suave hover:text-texto md:hidden">
              Cerrar sesión
            </button>
          </div>
          <nav aria-label="Principal" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:mt-4 md:flex-col md:overflow-visible md:px-0">
            <NavLink to="/" end className={enlace}>
              Resumen
            </NavLink>
            <NavLink to="/cotizaciones" className={enlace}>
              Cotizaciones
            </NavLink>
          </nav>
          <div className="mt-auto hidden border-t border-borde pt-4 md:block">
            <p className="truncate font-medium">{usuario?.nombre}</p>
            <p className="truncate text-sm text-texto-suave">{usuario?.email}</p>
            <button type="button" onClick={() => cerrarSesion()} className="mt-3 text-sm font-medium text-vidrio hover:underline">
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main id="contenido" className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
