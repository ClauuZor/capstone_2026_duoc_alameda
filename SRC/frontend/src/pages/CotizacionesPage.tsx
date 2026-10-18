import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { FiltrosCotizaciones } from "../api/types";
import { Campo, Encabezado, Entrada, Selector } from "../components/Controles";
import { EstadoCarga, EstadoError, EstadoVacio } from "../components/Estados";
import { Paginacion } from "../components/Paginacion";
import { useAnios, useClientes, useCotizaciones } from "../hooks/consultas";
import { useTitulo } from "../hooks/useTitulo";
import { escribirFiltros, hayFiltrosActivos, leerFiltros } from "../lib/filtros";
import { formatCLP, formatFecha, plural } from "../lib/format";

export function CotizacionesPage() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  useTitulo("Cotizaciones");
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const clientes = useClientes();
  const anios = useAnios();
  const cotizaciones = useCotizaciones(filtros);

  // Búsqueda con espera de 300 ms para no consultar la API en cada tecla.
  const [texto, setTexto] = useState(filtros.q ?? "");
  useEffect(() => setTexto(filtros.q ?? ""), [filtros.q]);
  useEffect(() => {
    if ((texto.trim() || undefined) === filtros.q) return;
    const t = setTimeout(() => actualizar({ q: texto.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function actualizar(cambios: Partial<FiltrosCotizaciones>) {
    // Cualquier cambio de filtro vuelve a la primera página.
    setParams(escribirFiltros({ ...filtros, page: 1, ...cambios }));
  }

  const datos = cotizaciones.data;
  const activos = hayFiltrosActivos(filtros);
  const abrir = (id: number) => navegar(`/cotizaciones/${id}`, { state: { volverA: ubicacion.search } });

  return (
    <>
      <Encabezado titulo="Cotizaciones" descripcion="Busca por número de cotización, nombre o RUT del cliente." />

      <section aria-label="Filtros" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_auto] lg:items-end">
        <Campo etiqueta="Buscar" id="buscar">
          <Entrada id="buscar" type="search" placeholder="Número, cliente o RUT" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <Campo etiqueta="Cliente" id="cliente">
          <Selector id="cliente" value={filtros.cliente_id ?? ""} onChange={(e) => actualizar({ cliente_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Todos los clientes</option>
            {clientes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Año" id="anio">
          <Selector id="anio" value={filtros.anio ?? ""} onChange={(e) => actualizar({ anio: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Todos</option>
            {anios.data?.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selector>
        </Campo>
        <button
          type="button"
          onClick={() => setParams({})}
          disabled={!activos}
          className="h-10 rounded-md px-3 font-medium text-vidrio hover:bg-vidrio-tenue disabled:hidden lg:disabled:invisible lg:disabled:block"
        >
          Limpiar filtros
        </button>
      </section>

      <div className="mt-6">
        {cotizaciones.isError ? (
          <EstadoError mensaje={cotizaciones.error.message} alReintentar={() => cotizaciones.refetch()} />
        ) : !datos ? (
          <EstadoCarga mensaje="Buscando cotizaciones…" />
        ) : datos.total === 0 ? (
          <EstadoVacio
            titulo="Ninguna cotización coincide con estos filtros"
            descripcion={activos ? "Prueba con otro término o quita algún filtro." : "Aún no hay cotizaciones procesadas."}
            accion={
              activos && (
                <button type="button" className="rounded-md bg-vidrio px-4 py-2 font-semibold text-white hover:bg-vidrio-fuerte dark:text-fondo" onClick={() => setParams({})}>
                  Limpiar filtros
                </button>
              )
            }
          />
        ) : (
          <>
            <p className="mb-2 text-sm text-texto-suave" aria-live="polite">
              {plural(datos.total, "cotización encontrada", "cotizaciones encontradas")}
              {cotizaciones.isFetching && ", actualizando…"}
            </p>
            <div className={`overflow-x-auto rounded-lg border border-borde bg-superficie ${cotizaciones.isPlaceholderData ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[40rem] text-left">
                <caption className="sr-only">Listado de cotizaciones</caption>
                <thead className="border-b border-borde text-sm text-texto-suave">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Número</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Ítems</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Neto</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Total con IVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {datos.items.map((c) => (
                    <tr key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer hover:bg-hundido">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/cotizaciones/${c.id}`}
                          state={{ volverA: ubicacion.search }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-vidrio hover:underline"
                        >
                          {c.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatFecha(c.fecha)}</td>
                      <td className="max-w-[18rem] truncate px-4 py-3" title={c.cliente.nombre}>
                        {c.cliente.nombre}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.cantidad_items}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatCLP(c.monto_neto)}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatCLP(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={datos.page} tamano={datos.page_size} total={datos.total} alCambiar={(page) => setParams(escribirFiltros({ ...filtros, page }))} />
          </>
        )}
      </div>
    </>
  );
}
