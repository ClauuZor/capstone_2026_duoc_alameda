import type { z } from "zod";
import type * as E from "./esquemas";
import type * as T from "./types";

// Comprobación en compilación (npm run typecheck): si types.ts y esquemas.ts divergen, esto no compila.
describe("esquemas del contrato", () => {
  it("coinciden con los tipos de types.ts", () => {
    expectTypeOf<z.infer<typeof E.TokenResponse>>().toEqualTypeOf<T.TokenResponse>();
    expectTypeOf<z.infer<typeof E.Usuario>>().toEqualTypeOf<T.Usuario>();
    expectTypeOf<z.infer<typeof E.ClienteResumen>>().toEqualTypeOf<T.ClienteResumen>();
    expectTypeOf<z.infer<typeof E.CotizacionResumen>>().toEqualTypeOf<T.CotizacionResumen>();
    expectTypeOf<z.infer<typeof E.CotizacionDetalle>>().toEqualTypeOf<T.CotizacionDetalle>();
    expectTypeOf<z.infer<typeof E.PaginaCotizaciones>>().toEqualTypeOf<T.Pagina<T.CotizacionResumen>>();
    expectTypeOf<z.infer<typeof E.MetricasResumen>>().toEqualTypeOf<T.MetricasResumen>();
    expectTypeOf<z.infer<typeof E.MetricaPeriodo>>().toEqualTypeOf<T.MetricaPeriodo>();
  });
});
