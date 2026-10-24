/**
 * Pruebas automáticas de perfil.service: guardar y escuchar el perfil del adulto mayor.
 * Firestore se reemplaza por mocks (sin red ni base real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const setDocMock = vi.fn();
const onSnapshotMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  setDoc: (...a: unknown[]) => setDocMock(...a),
  onSnapshot: (...a: unknown[]) => onSnapshotMock(...a),
  serverTimestamp: () => "__AHORA__",
}));
vi.mock("./firebase", () => ({ db: {} }));

import { escucharPerfil, guardarPerfil, ErrorPerfil } from "./perfil.service";
import { PERFIL_POR_DEFECTO, type PerfilAdulto } from "./perfil.logic";

const ELDER = "uid-adulto";
const CUIDADOR = "uid-cuidador";

beforeEach(() => {
  setDocMock.mockReset();
  setDocMock.mockResolvedValue(undefined);
  onSnapshotMock.mockReset();
});

describe("guardarPerfil", () => {
  it("guarda en perfilesAdulto/<elderUid> con el teléfono normalizado y quién lo cambió", async () => {
    const perfil: PerfilAdulto = {
      margenAvisoMin: 30,
      metas: { presion: { sistolica: { min: 100, max: 140 } } },
      contactoEmergencia: { nombre: " Ana ", telefono: "+56 9 1234 5678" },
    };
    await guardarPerfil(ELDER, CUIDADOR, perfil);
    const [ref, datos] = setDocMock.mock.calls[0];
    expect(ref).toEqual({ col: "perfilesAdulto", id: ELDER });
    expect(datos).toEqual({
      margenAvisoMin: 30,
      metas: { presion: { sistolica: { min: 100, max: 140 } } },
      contactoEmergencia: { nombre: "Ana", telefono: "+56912345678" },
      actualizadoPor: CUIDADOR,
      actualizadoEn: "__AHORA__",
    });
  });

  it("no escribe si el teléfono o el margen no son válidos", async () => {
    await expect(
      guardarPerfil(ELDER, CUIDADOR, { ...PERFIL_POR_DEFECTO, contactoEmergencia: { nombre: "Ana", telefono: "12" } })
    ).rejects.toBeInstanceOf(ErrorPerfil);
    await expect(guardarPerfil(ELDER, CUIDADOR, { ...PERFIL_POR_DEFECTO, margenAvisoMin: 0 })).rejects.toBeInstanceOf(
      ErrorPerfil
    );
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("propaga el error de Firestore (ej. permission-denied si no es su cuidador)", async () => {
    setDocMock.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(guardarPerfil(ELDER, CUIDADOR, PERFIL_POR_DEFECTO)).rejects.toThrow("permission-denied");
  });
});

describe("escucharPerfil", () => {
  it("sin documento entrega el perfil por defecto; con documento, lo guardado", () => {
    const recibidos: PerfilAdulto[] = [];
    escucharPerfil(ELDER, (p) => recibidos.push(p), () => undefined);
    const onNext = onSnapshotMock.mock.calls[0][1] as (snap: unknown) => void;
    onNext({ exists: () => false, data: () => undefined });
    onNext({ exists: () => true, data: () => ({ margenAvisoMin: 10, metas: {}, contactoEmergencia: null }) });
    expect(recibidos).toEqual([PERFIL_POR_DEFECTO, { margenAvisoMin: 10, metas: {}, contactoEmergencia: null }]);
  });
});
