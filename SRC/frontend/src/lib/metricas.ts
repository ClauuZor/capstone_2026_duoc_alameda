import type { MetricaPeriodo } from "../api/types";

/**
 * La API solo devuelve los meses con cotizaciones. Para un año, el gráfico necesita todos los meses
 * (hasta el mes actual si es el año en curso) para no ocultar los meses sin actividad.
 */
export function completarMeses(anio: number, datos: MetricaPeriodo[], hoy = new Date()): MetricaPeriodo[] {
  const ultimoMes = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
  const porPeriodo = new Map(datos.map((d) => [d.periodo, d]));
  return Array.from({ length: ultimoMes }, (_, i) => {
    const periodo = `${anio}-${String(i + 1).padStart(2, "0")}`;
    return porPeriodo.get(periodo) ?? { periodo, cantidad: 0, monto_neto: 0 };
  });
}

/** Monto promedio por cotización. Ambos valores vienen del mismo conjunto filtrado, así que el cociente es exacto. */
export const montoPromedio = (montoTotal: number, cantidad: number) => (cantidad > 0 ? Math.round(montoTotal / cantidad) : 0);
