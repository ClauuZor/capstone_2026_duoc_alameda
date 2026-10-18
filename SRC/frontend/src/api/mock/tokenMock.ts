import { decodificarJwt, tokenVigente } from "../../auth/token";
import { usuarios, type UsuarioMock } from "./datos";

export const DURACION_SESION_MS = 30 * 60 * 1000;

function base64Url(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Token con forma de JWT, sin firma real: solo sirve para el modo simulado. */
export function crearTokenMock(email: string, duracionMs = DURACION_SESION_MS) {
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ sub: email, exp: Math.floor((Date.now() + duracionMs) / 1000) }));
  return `${header}.${payload}.mock`;
}

export function usuarioDelToken(token: string | null): UsuarioMock | undefined {
  return tokenVigente(token) ? usuarios.find((u) => u.email === decodificarJwt(token)?.sub) : undefined;
}

export function credencialesValidas(email: string, password: string): UsuarioMock | undefined {
  return usuarios.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
}
