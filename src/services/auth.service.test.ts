/**
 * Pruebas de auth.service: el registro no deja cuentas "a medias" y el perfil faltante se reconoce.
 * Firebase se reemplaza por mocks (sin red ni base real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const borrarCuenta = vi.fn(async () => {});
const createUserMock = vi.fn();
const sendVerificationMock = vi.fn(async () => {});
const setDocMock = vi.fn();
const getDocMock = vi.fn();

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...a: unknown[]) => createUserMock(...a),
  sendEmailVerification: (...a: unknown[]) => sendVerificationMock(...(a as [])),
  signOut: vi.fn(async () => {}),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  getDoc: (...a: unknown[]) => getDocMock(...a),
  setDoc: (...a: unknown[]) => setDocMock(...a),
  Timestamp: { now: () => "__AHORA__" },
}));
vi.mock("./firebase", () => ({ auth: {}, db: {} }));
vi.mock("./reminders.service", () => ({ cancelarRecordatorios: vi.fn(async () => {}) }));
vi.mock("./push.service", () => ({ quitarTokenPush: vi.fn(async () => {}) }));

import { fetchAppUser, registerWithEmail } from "./auth.service";
import { ErrorPerfilInexistente } from "./auth.logic";

beforeEach(() => {
  vi.clearAllMocks();
  createUserMock.mockResolvedValue({ user: { uid: "uid-1", delete: borrarCuenta } });
  setDocMock.mockResolvedValue(undefined);
});

describe("registerWithEmail", () => {
  it("guarda el perfil y después envía el correo de verificación", async () => {
    const u = await registerWithEmail("a@b.cl", "secreta", "Ana", "elder");
    expect(u).toEqual({ uid: "uid-1", role: "elder", name: "Ana", email: "a@b.cl" });
    expect(setDocMock).toHaveBeenCalledWith(
      { col: "users", id: "uid-1" },
      { role: "elder", name: "Ana", email: "a@b.cl", createdAt: "__AHORA__" }
    );
    expect(sendVerificationMock).toHaveBeenCalled();
    expect(setDocMock.mock.invocationCallOrder[0]).toBeLessThan(sendVerificationMock.mock.invocationCallOrder[0]);
  });

  it("si el perfil no se guarda, borra la cuenta recién creada y no envía el correo", async () => {
    setDocMock.mockRejectedValue(Object.assign(new Error("sin red"), { code: "unavailable" }));
    await expect(registerWithEmail("a@b.cl", "secreta", "Ana", "elder")).rejects.toMatchObject({ code: "unavailable" });
    expect(borrarCuenta).toHaveBeenCalled();
    expect(sendVerificationMock).not.toHaveBeenCalled();
  });
});

describe("fetchAppUser", () => {
  it("cuenta sin perfil en users → ErrorPerfilInexistente", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await expect(fetchAppUser("uid-x")).rejects.toBeInstanceOf(ErrorPerfilInexistente);
  });

  it("devuelve rol y nombre del perfil", async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ role: "caregiver", name: "Pía", email: "p@b.cl" }) });
    await expect(fetchAppUser("uid-2")).resolves.toEqual({ uid: "uid-2", role: "caregiver", name: "Pía", email: "p@b.cl" });
  });
});
