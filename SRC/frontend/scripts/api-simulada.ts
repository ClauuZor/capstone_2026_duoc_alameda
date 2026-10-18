/**
 * Levanta la API simulada en http://localhost:8000/api/v1 (o PUERTO).
 *
 *   npm run api:simulada
 *   # en otra terminal, con VITE_API_MODE=http en .env.local:
 *   npm run dev
 *
 * Usuario: demo@cotiza.test / demo1234. Ver scripts/servidorContrato.ts.
 */
import { crearServidorContrato } from "./servidorContrato";

const puerto = Number(process.env.PUERTO ?? 8000);
crearServidorContrato().listen(puerto, () => {
  console.log(`API simulada de Cotiza+ en http://localhost:${puerto}/api/v1`);
  console.log("No es el backend real: responde con datos simulados según docs/contrato-api.md.");
});
