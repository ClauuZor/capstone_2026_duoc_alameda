import { crearTokenMock } from "../api/mock/mockClient";
import { decodificarJwt, getToken, msHastaExpirar, setToken, tokenVigente } from "./token";

describe("token", () => {
  it("decodifica el payload del JWT", () => {
    expect(decodificarJwt(crearTokenMock("demo@cotiza.test"))).toMatchObject({ sub: "demo@cotiza.test" });
  });

  it("rechaza tokens mal formados", () => {
    expect(decodificarJwt("no-es-un-jwt")).toBeNull();
    expect(decodificarJwt("a.%%%.c")).toBeNull();
  });

  it("considera expirado un token vencido o sin exp", () => {
    expect(tokenVigente(crearTokenMock("demo@cotiza.test", -1000))).toBe(false);
    expect(tokenVigente(crearTokenMock("demo@cotiza.test", 60_000))).toBe(true);
    expect(msHastaExpirar(`e30.${btoa(JSON.stringify({ sub: "x" }))}.firma`)).toBe(0);
  });

  it("guarda el token en sessionStorage y lo borra al cerrar sesión", () => {
    setToken("abc.def.ghi");
    expect(sessionStorage.getItem("cotizaplus.token")).toBe("abc.def.ghi");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});
