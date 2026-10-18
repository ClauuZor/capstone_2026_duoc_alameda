import { formatNumero } from "../lib/format";
import { totalPaginas } from "../lib/filtros";

interface Props {
  pagina: number;
  tamano: number;
  total: number;
  alCambiar: (pagina: number) => void;
}

export function Paginacion({ pagina, tamano, total, alCambiar }: Props) {
  const paginas = totalPaginas(total, tamano);
  if (total === 0) return null;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  const boton = "rounded-md border border-borde-fuerte bg-superficie px-3 py-1.5 font-medium hover:bg-hundido disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-texto-suave">
      <span>
        {formatNumero(desde)}–{formatNumero(hasta)} de {formatNumero(total)}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={boton} onClick={() => alCambiar(pagina - 1)} disabled={pagina <= 1}>
          Anterior
        </button>
        <span className="px-1 tabular-nums">
          Página {pagina} de {paginas}
        </span>
        <button type="button" className={boton} onClick={() => alCambiar(pagina + 1)} disabled={pagina >= paginas}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
