/**
 * Pruebas de errores.service: qué se guarda, el tope por sesión, que no repita y que nunca falle.
 * Firestore y Capacitor se reemplazan por mocks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let usuario: { uid: string } | null = { uid: "uid-1" };
const addDocMock = vi.fn();

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android" } }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, col: string) => ({ col })),
  addDoc: (...a: unknown[]) => addDocMock(...a),
  serverTimestamp: () => "__AHORA__",
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));
vi.mock("./firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return usuario;
    },
  },
}));

// el servicio cuenta lo enviado en la sesión: cada prueba parte con un módulo nuevo
async function cargar() {
  vi.resetModules();
  return import("./errores.service");
}

beforeEach(() => {
  usuario = { uid: "uid-1" };
  addDocMock.mockReset();
  addDocMock.mockResolvedValue({ id: "e1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registrarError", () => {
  it("guarda funcionalidad, mensaje, código, usuario, plataforma, versión y vencimiento a 30 días", async () => {
    const { registrarError, DIAS_RETENCION_ERRORES } = await cargar();
    const antes = Date.now();
    registrarError("mediciones.guardar", Object.assign(new Error("sin permiso"), { code: "permission-denied" }));
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const [col, datos] = addDocMock.mock.calls[0];
    expect(col).toEqual({ col: "registroErrores" });
    expect(datos).toMatchObject({
      funcionalidad: "mediciones.guardar",
      mensaje: "sin permiso",
      codigo: "permission-denied",
      uid: "uid-1",
      plataforma: "android",
      versionApp: "1.0.0",
      creadoEn: "__AHORA__",
    });
    const dias = (datos.expiraEn.ms - antes) / 86_400_000;
    expect(dias).toBeGreaterThanOrEqual(DIAS_RETENCION_ERRORES - 0.01);
    expect(dias).toBeLessThan(DIAS_RETENCION_ERRORES + 0.01);
  });

  it("no repite el mismo error dos veces seguidas", async () => {
    const { registrarError } = await cargar();
    registrarError("tareas.quitar", new Error("x"));
    registrarError("tareas.quitar", new Error("x"));
    registrarError("tareas.quitar", new Error("y"));
    expect(addDocMock).toHaveBeenCalledTimes(2);
  });

  it("respeta el tope de errores por sesión", async () => {
    const { registrarError, MAX_ERRORES_POR_SESION } = await cargar();
    for (let i = 0; i < MAX_ERRORES_POR_SESION + 5; i++) registrarError("f", new Error(`e${i}`));
    expect(addDocMock).toHaveBeenCalledTimes(MAX_ERRORES_POR_SESION);
  });

  it("sin sesión no escribe (las reglas lo rechazarían)", async () => {
    usuario = null;
    const { registrarError } = await cargar();
    registrarError("f", new Error("x"));
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("nunca lanza, aunque falle la escritura", async () => {
    addDocMock.mockRejectedValue(new Error("offline"));
    const { registrarError } = await cargar();
    expect(() => registrarError("f", new Error("x"))).not.toThrow();
    await Promise.resolve();
  });

  it("recorta mensajes largos", async () => {
    const { registrarError, LARGO_MAX_MENSAJE } = await cargar();
    registrarError("f", new Error("a".repeat(2000)));
    expect(addDocMock.mock.calls[0][1].mensaje).toHaveLength(LARGO_MAX_MENSAJE);
  });
});

describe("describirError", () => {
  it("acepta texto u objetos sin message", async () => {
    const { describirError } = await cargar();
    expect(describirError("falló")).toEqual({ mensaje: "falló", codigo: "" });
    expect(describirError({ code: "unavailable" }).codigo).toBe("unavailable");
  });
});
