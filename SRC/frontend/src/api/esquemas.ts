/**
 * Esquemas del contrato para validar respuestas reales en tiempo de ejecución.
 * Los usa la verificación del contrato (npm run verificar:api) y las pruebas de integración;
 * la aplicación no los importa, así que no aumentan el tamaño del build.
 * esquemas.test.ts comprueba en compilación que coinciden con los tipos de types.ts.
 */
import { z } from "zod";

const entero = z.number().int();
const montoCLP = entero.nonnegative({ message: "monto negativo" });
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "se esperaba YYYY-MM-DD");

export const TokenResponse = z.object({ access_token: z.string().min(10), token_type: z.literal("bearer") });

export const Usuario = z.object({ id: entero, email: z.string(), nombre: z.string() });

export const ClienteResumen = z.object({ id: entero, nombre: z.string().min(1), rut: z.string().nullable() });

export const CotizacionResumen = z.object({
  id: entero,
  numero: z.string().min(1),
  fecha: fechaISO,
  cliente: ClienteResumen,
  cantidad_items: entero.nonnegative(),
  monto_neto: montoCLP,
  iva: montoCLP,
  total: montoCLP,
});

export const ItemCotizacion = z.object({
  id: entero,
  linea: entero,
  descripcion: z.string(),
  cantidad: z.number().nonnegative(),
  unidad: z.string().nullable(),
  precio_unitario: montoCLP,
  subtotal: montoCLP,
});

export const CotizacionDetalle = CotizacionResumen.extend({
  items: z.array(ItemCotizacion),
  documento: z.object({ nombre_archivo: z.string(), url_drive: z.string().url().nullable() }),
});

export const pagina = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: entero.nonnegative(), page: entero.positive(), page_size: entero.positive() });

export const PaginaCotizaciones = pagina(CotizacionResumen);

export const Anios = z.array(entero);

export const MetricasResumen = z.object({ total_cotizaciones: entero.nonnegative(), clientes_unicos: entero.nonnegative(), monto_neto_total: montoCLP });

export const MetricaPeriodo = z.object({ periodo: z.string().regex(/^\d{4}(-\d{2})?$/, "se esperaba YYYY o YYYY-MM"), cantidad: entero.nonnegative(), monto_neto: montoCLP });

export const MetricasPorPeriodo = z.array(MetricaPeriodo);

export const ErrorFastAPI = z.object({ detail: z.unknown() });
