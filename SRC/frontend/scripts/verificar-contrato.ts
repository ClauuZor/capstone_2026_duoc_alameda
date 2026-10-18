/**
 * Verifica la API real contra el contrato.
 *
 *   VERIFICAR_API_URL=http://localhost:8000/api/v1 \
 *   VERIFICAR_EMAIL=usuario@empresa.cl VERIFICAR_PASSWORD=... \
 *   npm run verificar:api
 *
 * Sin variables, usa la API simulada local (npm run api:simulada) y el usuario demo.
 * Termina con código 1 si alguna verificación falla, para usarlo en CI.
 */
import { verificarContrato } from "./verificarContrato";

const baseUrl = process.env.VERIFICAR_API_URL ?? "http://localhost:8000/api/v1";
const resultados = await verificarContrato({
  baseUrl,
  email: process.env.VERIFICAR_EMAIL ?? "demo@cotiza.test",
  password: process.env.VERIFICAR_PASSWORD ?? "demo1234",
  origen: process.env.VERIFICAR_ORIGEN,
});

const icono = { ok: "✓", falla: "✗", advertencia: "!" } as const;
console.log(`\nVerificación del contrato contra ${baseUrl}\n`);
for (const r of resultados) console.log(`  ${icono[r.estado]} ${r.nombre}${r.detalle && r.estado !== "ok" ? `\n      ${r.detalle}` : ""}`);
const fallas = resultados.filter((r) => r.estado === "falla").length;
const advertencias = resultados.filter((r) => r.estado === "advertencia").length;
console.log(`\n${resultados.length - fallas - advertencias} correctas, ${fallas} fallas, ${advertencias} advertencias\n`);
process.exit(fallas ? 1 : 0);
