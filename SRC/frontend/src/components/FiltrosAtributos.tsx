import type { FiltrosAtributos as Filtros } from "../api/types";
import { useOpcionesFiltro } from "../hooks/consultas";
import { Campo, Selector } from "./Controles";

export const ETIQUETAS_ATRIBUTO = {
  material: "Material",
  color: "Color",
  vidrio: "Vidrio",
  comuna: "Comuna",
  vendedor: "Vendedor",
  tipo_cliente: "Tipo de cliente",
} as const;

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Un selector por atributo, con los valores que existen en los datos (del más al menos frecuente). */
export function FiltrosAtributos({ valores, alCambiar, prefijo }: { valores: Filtros; alCambiar: (cambios: Filtros) => void; prefijo: string }) {
  const opciones = useOpcionesFiltro();
  return (
    <>
      {(Object.keys(ETIQUETAS_ATRIBUTO) as (keyof typeof ETIQUETAS_ATRIBUTO)[]).map((clave) => {
        const lista = opciones.data?.[clave] ?? [];
        const id = `${prefijo}-${clave}`;
        return (
          <Campo key={clave} etiqueta={ETIQUETAS_ATRIBUTO[clave]} id={id}>
            <Selector id={id} value={valores[clave] ?? ""} onChange={(e) => alCambiar({ [clave]: e.target.value || undefined })} disabled={!lista.length && !valores[clave]}>
              <option value="">Todos</option>
              {valores[clave] && !lista.includes(valores[clave] as string) && <option value={valores[clave]}>{valores[clave]}</option>}
              {lista.map((v) => (
                <option key={v} value={v}>
                  {clave === "tipo_cliente" ? capitalizar(v) : v}
                </option>
              ))}
            </Selector>
          </Campo>
        );
      })}
    </>
  );
}

/** "PVC · Blanco · Termopanel" */
export const resumenProducto = (c: { material: string | null; color: string | null; vidrio: string | null }) =>
  [c.material, c.color, c.vidrio].filter(Boolean).join(" · ");
