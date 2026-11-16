import { useNavigate } from "react-router-dom";
import type { Dimension, FiltrosMetricas } from "../api/types";
import { useDistribucion } from "../hooks/consultas";
import { escribirFiltros } from "../lib/filtros";
import { formatCLP, formatCLPCorto, formatNumero, plural } from "../lib/format";

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * Ranking de una dimensión como barras horizontales de una sola serie (un color: la categoría
 * ya está escrita en la fila). Es una tabla real, así que también sirve como vista accesible.
 * Al elegir una fila se abre el listado de cotizaciones filtrado por ese valor.
 */
export function Distribucion({
  titulo,
  dimension,
  filtros,
  limite = 8,
  unidad = "cotización",
  unidadPlural = "cotizaciones",
}: {
  titulo: string;
  dimension: Dimension;
  filtros: FiltrosMetricas;
  limite?: number;
  unidad?: string;
  unidadPlural?: string;
}) {
  const navegar = useNavigate();
  const consulta = useDistribucion({ ...filtros, dimension, limite });
  const datos = consulta.data ?? [];
  const maximo = Math.max(1, ...datos.map((d) => d.monto_neto));
  const totalMonto = datos.reduce((s, d) => s + d.monto_neto, 0);
  // Productos y clientes no son filtros del listado por atributo (cliente usa su propio id).
  const filtrable = dimension !== "producto" && dimension !== "cliente";
  const idTitulo = `dist-${dimension}`;

  const abrir = (clave: string) => {
    if (!filtrable) return;
    navegar(`/cotizaciones?${escribirFiltros({ anio: filtros.anio, cliente_id: filtros.cliente_id, [dimension]: clave }).toString()}`);
  };

  return (
    <section aria-labelledby={idTitulo} className={`rounded-lg border border-borde bg-superficie p-4 ${consulta.isPlaceholderData ? "opacity-60" : ""}`}>
      <h2 id={idTitulo} className="font-semibold">
        {titulo}
      </h2>
      {consulta.isError ? (
        <p className="mt-3 text-sm text-error">No se pudo cargar.</p>
      ) : !consulta.data ? (
        <p className="mt-3 text-sm text-texto-suave">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="mt-3 text-sm text-texto-suave">Sin datos para este filtro.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">{titulo}: monto neto cotizado y cantidad</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{titulo}</th>
              <th scope="col">Monto neto</th>
              <th scope="col">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => {
              const porcentaje = totalMonto ? Math.round((d.monto_neto / totalMonto) * 100) : 0;
              const nombre = dimension === "tipo_cliente" ? capitalizar(d.clave) : d.clave;
              return (
                <tr
                  key={d.clave}
                  onClick={() => abrir(d.clave)}
                  title={`${nombre}: ${formatCLP(d.monto_neto)} · ${plural(d.cantidad, unidad, unidadPlural)} · ${porcentaje} % de lo mostrado`}
                  className={`group ${filtrable ? "cursor-pointer" : ""}`}
                >
                  <th scope="row" className="w-[40%] max-w-0 py-1.5 pr-3 text-left font-normal">
                    {filtrable ? (
                      <button type="button" className="block w-full truncate text-left group-hover:text-vidrio group-hover:underline" onClick={(e) => (e.stopPropagation(), abrir(d.clave))}>
                        {nombre}
                      </button>
                    ) : (
                      <span className="block truncate">{nombre}</span>
                    )}
                  </th>
                  <td className="py-1.5 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-hundido" aria-hidden>
                        <div className="h-2 rounded-full bg-vidrio transition-[width] group-hover:bg-vidrio-fuerte" style={{ width: `${Math.max(2, (d.monto_neto / maximo) * 100)}%` }} />
                      </div>
                      <span className="cifra w-20 shrink-0 text-right tabular-nums">{formatCLPCorto(d.monto_neto)}</span>
                    </div>
                  </td>
                  <td className="w-24 py-1.5 pl-2 text-right text-texto-suave tabular-nums">{formatNumero(d.cantidad)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
