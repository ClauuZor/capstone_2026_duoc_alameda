import { Link, useLocation, useParams } from "react-router-dom";
import { Encabezado } from "../components/Controles";
import { EstadoCarga, EstadoError, EstadoVacio } from "../components/Estados";
import { useCotizacion } from "../hooks/consultas";
import { useTitulo } from "../hooks/useTitulo";
import { formatCLP, formatFecha, formatNumero } from "../lib/format";

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Bloque de datos etiqueta/valor; las filas sin valor no se muestran. */
function Ficha({ titulo, filas }: { titulo: string; filas: [string, string | null | undefined][] }) {
  const visibles = filas.filter(([, v]) => v);
  return (
    <div className="rounded-lg border border-borde bg-superficie p-4">
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      {visibles.length === 0 ? (
        <p className="text-sm text-texto-suave">Sin datos en el PDF.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {visibles.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="contents">
              <dt className="text-texto-suave">{etiqueta}</dt>
              <dd className="min-w-0 break-words">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function CotizacionDetallePage() {
  const { id } = useParams();
  const ubicacion = useLocation();
  const volverA = (ubicacion.state as { volverA?: string } | null)?.volverA ?? "";
  const idNumerico = Number(id);
  const valido = Number.isInteger(idNumerico) && idNumerico > 0;
  const consulta = useCotizacion(valido ? idNumerico : null);
  useTitulo(consulta.data?.numero ?? "Cotización");

  const volver = (
    <Link to={`/cotizaciones${volverA}`} className="text-sm font-medium text-vidrio hover:underline">
      Volver a cotizaciones
    </Link>
  );

  if (!valido || (consulta.isError && "status" in consulta.error && consulta.error.status === 404)) {
    return <EstadoVacio principal titulo="No encontramos esta cotización" descripcion="Puede que el enlace esté incompleto o que la cotización haya sido eliminada." accion={volver} />;
  }
  if (consulta.isError) return <EstadoError mensaje={consulta.error.message} alReintentar={() => consulta.refetch()} />;
  if (!consulta.data) return <EstadoCarga mensaje="Cargando cotización…" />;

  const c = consulta.data;
  const m2Total = c.items.reduce((s, it) => s + (it.es_servicio ? 0 : (it.m2 ?? 0)), 0);
  const hayMedidas = c.items.some((it) => it.ancho_m !== null);
  const hayDenominacion = c.items.some((it) => it.denominacion);
  const columnasAntesDelSubtotal = 4 + (hayDenominacion ? 1 : 0) + (hayMedidas ? 1 : 0);

  return (
    <>
      <div className="mb-4">{volver}</div>
      <Encabezado
        titulo={c.numero}
        descripcion={
          <>
            <span className="block font-medium text-texto">{c.cliente.nombre}</span>
            <span className="block">
              Emitida el {formatFecha(c.fecha)}
              {c.cliente.rut && <>, RUT {c.cliente.rut}</>}
            </span>
          </>
        }
        extra={
          <div className="text-right">
            <p className="text-sm text-texto-suave">Total con IVA</p>
            <p className="cifra text-3xl font-semibold md:text-4xl">{formatCLP(c.total)}</p>
          </div>
        }
      />

      <section aria-label="Datos de la cotización" className="mb-8 grid gap-4 md:grid-cols-3">
        <Ficha
          titulo="Cliente"
          filas={[
            ["Nombre", c.cliente.nombre],
            ["RUT", c.cliente.rut],
            ["Tipo", c.tipo_cliente && capitalizar(c.tipo_cliente)],
            ["Teléfono", c.cliente_telefono],
            ["Correo", c.cliente_email],
          ]}
        />
        <Ficha
          titulo="Proyecto"
          filas={[
            ["Descripción", c.proyecto],
            ["Material", c.material],
            ["Color", c.color],
            ["Vidrio", c.vidrio],
            ["Comuna", c.comuna],
            ["Dirección", c.direccion],
            ["Superficie", m2Total > 0 ? `${formatNumero(Math.round(m2Total * 100) / 100)} m²` : null],
          ]}
        />
        <Ficha
          titulo="Condiciones"
          filas={[
            ["Emisión", formatFecha(c.fecha)],
            ["Vencimiento", c.fecha_vencimiento && formatFecha(c.fecha_vencimiento)],
            ["Vendedor", c.vendedor],
            ["Descuento", c.descuento > 0 ? `${formatCLP(c.descuento)} (${Math.round((c.descuento / c.subtotal_bruto) * 1000) / 10} %)` : "Sin descuento"],
          ]}
        />
      </section>

      <section aria-labelledby="titulo-items">
        <h2 id="titulo-items" className="mb-3 text-lg font-semibold">
          Ítems
        </h2>
        <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="border-b border-borde text-sm text-texto-suave">
              <tr>
                <th scope="col" className="w-12 px-4 py-2.5 font-medium">#</th>
                {hayDenominacion && <th scope="col" className="px-4 py-2.5 font-medium">Código</th>}
                <th scope="col" className="px-4 py-2.5 font-medium">Descripción</th>
                {hayMedidas && <th scope="col" className="px-4 py-2.5 text-right font-medium">Medidas</th>}
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Precio unitario</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {c.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 text-texto-suave tabular-nums">{it.linea}</td>
                  {hayDenominacion && <td className="px-4 py-3 font-medium whitespace-nowrap">{it.denominacion}</td>}
                  <td className="px-4 py-3">
                    {it.descripcion}
                    {it.categoria && (
                      <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${it.es_servicio ? "bg-hundido text-texto-suave" : "bg-vidrio-tenue text-vidrio-fuerte"}`}>
                        {it.categoria}
                      </span>
                    )}
                  </td>
                  {hayMedidas && (
                    <td className="px-4 py-3 text-right text-sm whitespace-nowrap text-texto-suave tabular-nums">
                      {it.ancho_m !== null && it.alto_m !== null && (
                        <>
                          {formatNumero(it.ancho_m)} × {formatNumero(it.alto_m)} m
                          {it.m2 !== null && <span className="block">{formatNumero(it.m2)} m²</span>}
                        </>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatNumero(it.cantidad)} {it.unidad}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatCLP(it.precio_unitario)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatCLP(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-borde-fuerte">
              {(
                [
                  ...(c.descuento > 0
                    ? [
                        ["Subtotal", c.subtotal_bruto],
                        ["Descuento", -c.descuento],
                      ]
                    : []),
                  ["Neto", c.monto_neto],
                  ["IVA (19 %)", c.iva],
                  ["Total", c.total],
                ] as [string, number][]
              ).map(([etiqueta, monto]) => (
                <tr key={etiqueta} className={etiqueta === "Total" ? "font-semibold" : ""}>
                  <th scope="row" colSpan={columnasAntesDelSubtotal} className="px-4 py-2 text-right font-medium text-texto-suave">
                    {etiqueta}
                  </th>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">{formatCLP(monto as number)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="titulo-origen" className="mt-8 border-t border-borde pt-6">
        <h2 id="titulo-origen" className="font-semibold">
          Documento de origen
        </h2>
        <p className="mt-2 break-all">
          {c.documento.url_drive ? (
            <a href={c.documento.url_drive} target="_blank" rel="noreferrer" className="font-medium text-vidrio hover:underline">
              {c.documento.nombre_archivo} (abrir en Google Drive)
            </a>
          ) : (
            c.documento.nombre_archivo
          )}
        </p>
      </section>
    </>
  );
}
