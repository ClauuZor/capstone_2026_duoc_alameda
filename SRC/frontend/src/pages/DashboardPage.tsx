import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { FiltrosMetricas, MetricaPeriodo } from "../api/types";
import { Campo, Encabezado, Selector } from "../components/Controles";
import { EstadoCarga, EstadoError, EstadoVacio } from "../components/Estados";
import { useAnios, useClientes, useMetricasPeriodo, useMetricasResumen } from "../hooks/consultas";
import { useTitulo } from "../hooks/useTitulo";
import { Distribucion } from "../components/Distribucion";
import { FiltrosAtributos } from "../components/FiltrosAtributos";
import { escribirFiltros, escribirFiltrosResumen, hayFiltrosAtributo, leerFiltrosResumen } from "../lib/filtros";
import { formatCLP, formatCLPCorto, formatNumero, formatPeriodo, plural } from "../lib/format";
import { completarMeses, montoPromedio } from "../lib/metricas";

function Cifra({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0 border-borde py-4 pr-4 even:border-l even:pl-4 [&:nth-child(n+3)]:border-t lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0 lg:[&:nth-child(n+3)]:border-t-0">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="cifra mt-1 truncate text-[1.6rem] leading-tight font-semibold md:text-[2rem]">{valor}</dd>
      {detalle && <dd className="mt-0.5 truncate text-sm text-texto-suave">{detalle}</dd>}
    </div>
  );
}

function InfoPeriodo({ active, payload, conAnio }: TooltipProps<number, string> & { conAnio: boolean }) {
  const d = payload?.[0]?.payload as MetricaPeriodo | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-md border border-borde bg-superficie px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold capitalize">{formatPeriodo(d.periodo, conAnio)}</p>
      <p className="cifra">{formatCLP(d.monto_neto)}</p>
      <p className="text-texto-suave">{plural(d.cantidad, "cotización", "cotizaciones")}</p>
    </div>
  );
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltrosResumen(params);
  useTitulo("Resumen");
  const anios = useAnios();
  const clientes = useClientes();
  const resumen = useMetricasResumen(filtros);
  const periodo = useMetricasPeriodo({ ...filtros, granularidad: filtros.anio ? "mes" : "anio" });

  const actualizar = (cambios: Partial<FiltrosMetricas>) => setParams(escribirFiltrosResumen({ ...filtros, ...cambios }));
  const opcionesAnio = [...new Set([...(anios.data ?? []), new Date().getFullYear()])].sort((a, b) => b - a);
  const serie = filtros.anio && periodo.data ? completarMeses(filtros.anio, periodo.data) : (periodo.data ?? []);
  const nombreCliente = clientes.data?.find((c) => c.id === filtros.cliente_id)?.nombre;
  const alcance = [filtros.anio ? `en ${filtros.anio}` : "en todos los años", nombreCliente && `de ${nombreCliente}`].filter(Boolean).join(" ");
  const tituloGrafico = filtros.anio ? `Monto cotizado por mes, ${filtros.anio}` : "Monto cotizado por año";

  return (
    <>
      <Encabezado titulo="Resumen" descripcion="Montos cotizados sin IVA. Una cotización no es una venta cerrada." />

      <section aria-label="Filtros del resumen" className="mb-6 grid gap-3 sm:grid-cols-[11rem_minmax(0,22rem)]">
        <Campo etiqueta="Período" id="anio-resumen">
          <Selector id="anio-resumen" value={filtros.anio ?? "todos"} onChange={(e) => actualizar({ anio: e.target.value === "todos" ? undefined : Number(e.target.value) })}>
            {opcionesAnio.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="todos">Todos los años</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Cliente" id="cliente-resumen">
          <Selector id="cliente-resumen" value={filtros.cliente_id ?? ""} onChange={(e) => actualizar({ cliente_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Todos los clientes</option>
            {clientes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      </section>

      <details className="-mt-3 mb-6 rounded-lg border border-borde bg-superficie" open={hayFiltrosAtributo(filtros)}>
        <summary className="cursor-pointer px-4 py-2.5 font-medium select-none">Filtrar por material, vidrio, comuna o vendedor</summary>
        <section aria-label="Filtros por atributo" className="grid gap-3 border-t border-borde p-4 sm:grid-cols-3 lg:grid-cols-6">
          <FiltrosAtributos prefijo="res" valores={filtros} alCambiar={actualizar} />
        </section>
      </details>

      {resumen.isError ? (
        <EstadoError mensaje={resumen.error.message} alReintentar={() => resumen.refetch()} />
      ) : !resumen.data ? (
        <EstadoCarga mensaje="Calculando métricas…" />
      ) : resumen.data.total_cotizaciones === 0 ? (
        <EstadoVacio
          titulo={`No hay cotizaciones registradas ${alcance}`}
          descripcion="Cuando se suba un PDF a la carpeta de Google Drive aparecerá aquí después de procesarse."
          accion={
            <button type="button" className="font-medium text-vidrio hover:underline" onClick={() => setParams({ anio: "todos" })}>
              Ver todos los años y clientes
            </button>
          }
        />
      ) : (
        <>
          <section aria-label="Indicadores" className={resumen.isPlaceholderData ? "opacity-60 transition-opacity" : ""}>
            <dl className="grid grid-cols-2 border-y border-borde lg:grid-cols-4">
              <Cifra etiqueta="Cotizaciones" valor={formatNumero(resumen.data.total_cotizaciones)} />
              <Cifra etiqueta="Clientes únicos" valor={formatNumero(resumen.data.clientes_unicos)} />
              <Cifra etiqueta="Monto cotizado" valor={formatCLPCorto(resumen.data.monto_neto_total)} detalle={formatCLP(resumen.data.monto_neto_total)} />
              <Cifra
                etiqueta="Monto promedio"
                valor={formatCLPCorto(montoPromedio(resumen.data.monto_neto_total, resumen.data.total_cotizaciones))}
                detalle="por cotización"
              />
            </dl>
            <dl className="grid grid-cols-2 border-b border-borde lg:grid-cols-4">
              <Cifra etiqueta="Total con IVA" valor={formatCLPCorto(resumen.data.monto_total)} detalle={formatCLP(resumen.data.monto_total)} />
              <Cifra
                etiqueta="Superficie cotizada"
                valor={`${formatNumero(Math.round(resumen.data.m2_cotizados))} m²`}
                detalle={resumen.data.m2_cotizados > 0 ? `${formatCLP(Math.round(resumen.data.monto_neto_total / resumen.data.m2_cotizados))} por m² aprox.` : "ítems con medidas"}
              />
              <Cifra
                etiqueta="Con instalación"
                valor={`${porcentaje(resumen.data.cotizaciones_con_instalacion, resumen.data.total_cotizaciones)} %`}
                detalle={plural(resumen.data.cotizaciones_con_instalacion, "cotización", "cotizaciones")}
              />
              <Cifra
                etiqueta="Con descuento"
                valor={`${porcentaje(resumen.data.cotizaciones_con_descuento, resumen.data.total_cotizaciones)} %`}
                detalle={resumen.data.descuento_total > 0 ? `${formatCLPCorto(resumen.data.descuento_total)} descontados` : "sin descuentos"}
              />
            </dl>
            <Link
              to={`/cotizaciones?${escribirFiltros({ anio: filtros.anio, cliente_id: filtros.cliente_id }).toString()}`}
              className="mt-3 inline-block text-sm font-medium text-vidrio hover:underline"
            >
              Ver las {plural(resumen.data.total_cotizaciones, "cotización", "cotizaciones")} {alcance}
            </Link>
          </section>

          <section aria-labelledby="titulo-periodo" className="mt-10">
            <h2 id="titulo-periodo" className="text-lg font-semibold">
              {tituloGrafico}
            </h2>
            {periodo.isError ? (
              <EstadoError mensaje={periodo.error.message} alReintentar={() => periodo.refetch()} />
            ) : (
              <>
                <div className="mt-4 h-72" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--c-borde)" />
                      <XAxis dataKey="periodo" interval={0} tickFormatter={(p: string) => formatPeriodo(p)} tick={{ fill: "var(--c-texto-suave)", fontSize: 12 }} axisLine={{ stroke: "var(--c-borde-fuerte)" }} tickLine={false} />
                      <YAxis tickFormatter={formatCLPCorto} tick={{ fill: "var(--c-texto-suave)", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip cursor={{ fill: "var(--c-hundido)" }} content={<InfoPeriodo conAnio={!filtros.anio} />} />
                      <Bar dataKey="monto_neto" fill="var(--c-vidrio)" radius={[2, 2, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Alternativa accesible al gráfico: los mismos datos como tabla para lectores de pantalla. */}
                {/* sr-only va en un div: una <table> ignora el alto de 1 px y alargaría la página. */}
                <div className="sr-only">
                <table>
                  <caption>{tituloGrafico}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Cotizaciones</th>
                      <th scope="col">Monto neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map((p) => (
                      <tr key={p.periodo}>
                        <th scope="row">{formatPeriodo(p.periodo, true)}</th>
                        <td>{p.cantidad}</td>
                        <td>{formatCLP(p.monto_neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </section>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">¿Qué se cotiza?</h2>
            <p className="text-sm text-texto-suave">Monto neto {alcance} y cantidad de cotizaciones. Elige una fila para ver esas cotizaciones.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Distribucion titulo="Por material" dimension="material" filtros={filtros} />
              <Distribucion titulo="Por tipo de vidrio" dimension="vidrio" filtros={filtros} />
              <Distribucion titulo="Por color" dimension="color" filtros={filtros} />
              <Distribucion titulo="Productos más cotizados" dimension="producto" filtros={filtros} unidad="unidad" unidadPlural="unidades" />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">¿A quién y dónde?</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Distribucion titulo="Clientes con más monto cotizado" dimension="cliente" filtros={filtros} limite={10} />
              <Distribucion titulo="Comunas" dimension="comuna" filtros={filtros} limite={10} />
              <Distribucion titulo="Por vendedor" dimension="vendedor" filtros={filtros} />
              <Distribucion titulo="Tipo de cliente" dimension="tipo_cliente" filtros={filtros} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);
