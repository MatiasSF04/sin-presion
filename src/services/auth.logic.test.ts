/** Pruebas de auth.logic: mensajes de error del acceso y tiempo límite de espera. */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  conTiempoLimite, ErrorPerfilInexistente, ErrorTiempoLimite, esErrorDeConexion, mensajeErrorAcceso, MENSAJES_ACCESO,
} from "./auth.logic";

const conCodigo = (code: string) => Object.assign(new Error(code), { code });

describe("mensajeErrorAcceso", () => {
  it("credenciales incorrectas o cuenta inexistente → mismo mensaje (no revela si el correo existe)", () => {
    for (const c of ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"]) {
      expect(mensajeErrorAcceso(conCodigo(c), "login")).toBe(MENSAJES_ACCESO.credenciales);
    }
  });

  it("sin red o tiempo límite → mensaje de conexión", () => {
    expect(mensajeErrorAcceso(conCodigo("auth/network-request-failed"), "login")).toBe(MENSAJES_ACCESO.conexion);
    expect(mensajeErrorAcceso(new ErrorTiempoLimite(), "login")).toBe(MENSAJES_ACCESO.conexion);
    expect(mensajeErrorAcceso(conCodigo("unavailable"), "login")).toBe(MENSAJES_ACCESO.conexion);
  });

  it("cuenta sin perfil en users → mensaje de cuenta incompleta", () => {
    expect(mensajeErrorAcceso(new ErrorPerfilInexistente(), "login")).toBe(MENSAJES_ACCESO.sinPerfil);
  });

  it("demasiados intentos y cuenta desactivada", () => {
    expect(mensajeErrorAcceso(conCodigo("auth/too-many-requests"), "login")).toBe(MENSAJES_ACCESO.intentos);
    expect(mensajeErrorAcceso(conCodigo("auth/user-disabled"), "login")).toBe(MENSAJES_ACCESO.desactivada);
  });

  it("errores del registro", () => {
    expect(mensajeErrorAcceso(conCodigo("auth/email-already-in-use"), "registro")).toBe(MENSAJES_ACCESO.correoEnUso);
    expect(mensajeErrorAcceso(conCodigo("auth/invalid-email"), "registro")).toBe(MENSAJES_ACCESO.correoInvalido);
    expect(mensajeErrorAcceso(conCodigo("auth/weak-password"), "registro")).toBe(MENSAJES_ACCESO.claveDebil);
    expect(mensajeErrorAcceso(new ErrorTiempoLimite(), "registro")).toBe(MENSAJES_ACCESO.registroIncierto);
  });

  it("error desconocido → mensaje genérico según el contexto", () => {
    expect(mensajeErrorAcceso(new Error("x"), "login")).toBe(MENSAJES_ACCESO.loginGenerico);
    expect(mensajeErrorAcceso("raro", "registro")).toBe(MENSAJES_ACCESO.registroGenerico);
  });
});

describe("esErrorDeConexion", () => {
  it("reconoce el mensaje 'client is offline' de Firestore", () => {
    expect(esErrorDeConexion(new Error("Failed to get document because the client is offline."))).toBe(true);
    expect(esErrorDeConexion(conCodigo("auth/invalid-credential"))).toBe(false);
  });
});

describe("conTiempoLimite", () => {
  afterEach(() => vi.useRealTimers());

  it("entrega el resultado si llega a tiempo", async () => {
    await expect(conTiempoLimite(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("propaga el error original si falla a tiempo", async () => {
    await expect(conTiempoLimite(Promise.reject(conCodigo("auth/x")), 1000)).rejects.toMatchObject({ code: "auth/x" });
  });

  it("rechaza con ErrorTiempoLimite si no hay respuesta", async () => {
    vi.useFakeTimers();
    const espera = conTiempoLimite(new Promise(() => {}), 20_000);
    vi.advanceTimersByTime(20_000);
    await expect(espera).rejects.toBeInstanceOf(ErrorTiempoLimite);
  });
});
