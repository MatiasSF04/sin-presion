/**
 * Pruebas automáticas de push.service: registro del teléfono del cuidador y limpieza al cerrar sesión.
 * Capacitor y Firestore se reemplazan por mocks (sin teléfono, red ni base real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let nativo = true;
let permiso = "granted";
const listeners: Record<string, (x: unknown) => void> = {};

const push = {
  checkPermissions: vi.fn(async () => ({ receive: permiso })),
  requestPermissions: vi.fn(async () => ({ receive: permiso })),
  createChannel: vi.fn(async () => {}),
  register: vi.fn(async () => {}),
  unregister: vi.fn(async () => {}),
  addListener: vi.fn(async (ev: string, fn: (x: unknown) => void) => {
    listeners[ev] = fn;
    return { remove: vi.fn() };
  }),
};
const setDocMock = vi.fn(async () => {});
const deleteDocMock = vi.fn(async () => {});

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => nativo, getPlatform: () => "android" },
}));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: push }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  setDoc: (...a: unknown[]) => setDocMock(...(a as [])),
  deleteDoc: (...a: unknown[]) => deleteDocMock(...(a as [])),
  serverTimestamp: () => "__AHORA__",
}));
vi.mock("./firebase", () => ({ db: {} }));

// el servicio guarda estado (teléfono ya registrado): cada prueba parte con un módulo nuevo
async function cargar() {
  vi.resetModules();
  return import("./push.service");
}

beforeEach(() => {
  nativo = true;
  permiso = "granted";
  for (const k of Object.keys(listeners)) delete listeners[k];
  for (const f of Object.values(push)) f.mockClear();
  setDocMock.mockClear();
  deleteDocMock.mockClear();
});

describe("registrarPush", () => {
  it("en la web no hace nada", async () => {
    nativo = false;
    const { registrarPush } = await cargar();
    expect(await registrarPush("uid-cuidador")).toBe(false);
    expect(push.register).not.toHaveBeenCalled();
  });

  it("con permiso crea el canal, registra y guarda el token con el uid del cuidador", async () => {
    const { registrarPush, CANAL_AVISOS } = await cargar();
    expect(await registrarPush("uid-cuidador")).toBe(true);
    expect(push.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: CANAL_AVISOS, importance: 5 }));
    expect(push.register).toHaveBeenCalledTimes(1);

    listeners["registration"]({ value: "token-abc" });
    await Promise.resolve();
    expect(setDocMock).toHaveBeenCalledWith(
      { col: "tokensPush", id: "token-abc" },
      { uid: "uid-cuidador", plataforma: "android", actualizadoEn: "__AHORA__" }
    );
  });

  it("pide el permiso si aún no se ha preguntado", async () => {
    permiso = "prompt";
    push.requestPermissions.mockResolvedValueOnce({ receive: "granted" });
    const { registrarPush } = await cargar();
    expect(await registrarPush("uid-cuidador")).toBe(true);
    expect(push.requestPermissions).toHaveBeenCalled();
  });

  it("sin permiso no registra el teléfono", async () => {
    permiso = "denied";
    const { registrarPush } = await cargar();
    expect(await registrarPush("uid-cuidador")).toBe(false);
    expect(push.register).not.toHaveBeenCalled();
  });

  it("llamarla dos veces con el mismo usuario registra una sola vez", async () => {
    const { registrarPush } = await cargar();
    await registrarPush("uid-cuidador");
    await registrarPush("uid-cuidador");
    expect(push.register).toHaveBeenCalledTimes(1);
  });
});

describe("quitarTokenPush", () => {
  it("borra el token de este teléfono y lo da de baja", async () => {
    const { registrarPush, quitarTokenPush } = await cargar();
    await registrarPush("uid-cuidador");
    listeners["registration"]({ value: "token-abc" });
    await Promise.resolve();

    await quitarTokenPush();
    expect(deleteDocMock).toHaveBeenCalledWith({ col: "tokensPush", id: "token-abc" });
    expect(push.unregister).toHaveBeenCalled();
  });

  it("en la web no hace nada", async () => {
    nativo = false;
    const { quitarTokenPush } = await cargar();
    await quitarTokenPush();
    expect(deleteDocMock).not.toHaveBeenCalled();
    expect(push.unregister).not.toHaveBeenCalled();
  });
});
