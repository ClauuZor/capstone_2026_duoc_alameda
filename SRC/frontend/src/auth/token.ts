const CLAVE = "cotizaplus.token";
let tokenEnMemoria: string | null = null;

/**
 * El token vive en memoria y se respalda en sessionStorage (se borra al cerrar la pestaña).
 * Se evita localStorage para no dejar sesiones persistentes en equipos compartidos.
 */
export function getToken(): string | null {
  if (tokenEnMemoria) return tokenEnMemoria;
  try {
    tokenEnMemoria = sessionStorage.getItem(CLAVE);
  } catch {
    tokenEnMemoria = null;
  }
  return tokenEnMemoria;
}

export function setToken(token: string | null) {
  tokenEnMemoria = token;
  try {
    if (token) sessionStorage.setItem(CLAVE, token);
    else sessionStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible: queda solo en memoria */
  }
}

export interface PayloadJwt {
  sub?: string;
  exp?: number;
  [k: string]: unknown;
}

function base64UrlADecodificado(segmento: string): string {
  const b64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = b64 + "===".slice((b64.length + 3) % 4);
  const binario = atob(relleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Lee el payload sin verificar la firma: la verificación es responsabilidad del backend. */
export function decodificarJwt(token: string): PayloadJwt | null {
  const partes = token.split(".");
  if (partes.length !== 3 || !partes[1]) return null;
  try {
    const payload = JSON.parse(base64UrlADecodificado(partes[1]));
    return typeof payload === "object" && payload !== null ? (payload as PayloadJwt) : null;
  } catch {
    return null;
  }
}

/** Un token sin `exp` se considera inválido: el contrato exige expiración. */
export function msHastaExpirar(token: string, ahora = Date.now()): number {
  const exp = decodificarJwt(token)?.exp;
  if (typeof exp !== "number") return 0;
  return Math.max(0, exp * 1000 - ahora);
}

export function tokenVigente(token: string | null, ahora = Date.now()): token is string {
  return !!token && msHastaExpirar(token, ahora) > 0;
}
