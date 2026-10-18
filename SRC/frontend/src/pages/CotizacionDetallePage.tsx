import { Link, useLocation, useParams } from "react-router-dom";
import { Encabezado } from "../components/Controles";
import { EstadoCarga, EstadoError, EstadoVacio } from "../components/Estados";
import { useCotizacion } from "../hooks/consultas";
import { useTitulo } from "../hooks/useTitulo";
import { formatCLP, formatFecha, formatNumero } from "../lib/format";

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

      <section aria-labelledby="titulo-items">
        <h2 id="titulo-items" className="sr-only">
          Ítems
        </h2>
        <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="border-b border-borde text-sm text-texto-suave">
              <tr>
                <th scope="col" className="w-12 px-4 py-2.5 font-medium">#</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Descripción</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Precio unitario</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {c.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 text-texto-suave tabular-nums">{it.linea}</td>
                  <td className="px-4 py-3">{it.descripcion}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatNumero(it.cantidad)} {it.unidad}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatCLP(it.precio_unitario)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatCLP(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-borde-fuerte">
              {[
                ["Neto", c.monto_neto],
                ["IVA (19 %)", c.iva],
                ["Total", c.total],
              ].map(([etiqueta, monto], i) => (
                <tr key={etiqueta as string} className={i === 2 ? "font-semibold" : ""}>
                  <th scope="row" colSpan={4} className="px-4 py-2 text-right font-medium text-texto-suave">
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
