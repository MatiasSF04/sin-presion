/**
 * Pruebas automáticas de link.service (generar y canjear el código de vinculación).
 * Firestore se reemplaza por mocks: no toca la base real ni usa red.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const setDocMock = vi.fn();
const getDocMock = vi.fn();
const batchSet = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  getDoc: (...a: unknown[]) => getDocMock(...a),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  setDoc: (...a: unknown[]) => setDocMock(...a),
  writeBatch: () => ({ set: batchSet, delete: batchDelete, commit: batchCommit }),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}));
vi.mock("./firebase", () => ({ db: {} }));

import { canjearCodigoVinculo, generarCodigoVinculo, ErrorVinculo } from "./link.service";

const ELDER = "uid-adulto";
const CUIDADOR = "uid-cuidador";
const enMinutos = (m: number) => ({ toDate: () => new Date(Date.now() + m * 60_000) });
const docCodigo = (expiraEn: { toDate: () => Date }) => ({
  exists: () => true,
  data: () => ({ elderUid: ELDER, expiraEn }),
  ref: { col: "codigosVinculo", id: "482917" },
});
const noExiste = { exists: () => false };

beforeEach(() => {
  [setDocMock, getDocMock, batchSet, batchDelete, batchCommit].forEach((m) => m.mockReset());
});

describe("generarCodigoVinculo", () => {
  it("guarda el código con el elderUid y una expiración futura", async () => {
    setDocMock.mockResolvedValue(undefined);
    const { codigo, expiraEn } = await generarCodigoVinculo(ELDER);
    expect(codigo).toMatch(/^\d{6}$/);
    expect(expiraEn.getTime()).toBeGreaterThan(Date.now());
    const [ref, datos] = setDocMock.mock.calls[0];
    expect(ref).toEqual({ col: "codigosVinculo", id: codigo });
    expect(datos.elderUid).toBe(ELDER);
  });

  it("si el código ya existe (permission-denied) reintenta con otro", async () => {
    setDocMock
      .mockRejectedValueOnce({ code: "permission-denied" })
      .mockResolvedValueOnce(undefined);
    await generarCodigoVinculo(ELDER);
    expect(setDocMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta ante otros errores (p. ej. sin conexión)", async () => {
    setDocMock.mockRejectedValue({ code: "unavailable" });
    await expect(generarCodigoVinculo(ELDER)).rejects.toEqual({ code: "unavailable" });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});

describe("canjearCodigoVinculo", () => {
  it("crea el vínculo con id <elder>_<cuidador> y borra el código en el mismo batch", async () => {
    getDocMock.mockResolvedValueOnce(docCodigo(enMinutos(10))).mockResolvedValueOnce(noExiste);
    batchCommit.mockResolvedValue(undefined);

    await expect(canjearCodigoVinculo(CUIDADOR, "482 917")).resolves.toBe(ELDER);

    const [ref, datos] = batchSet.mock.calls[0];
    expect(ref).toEqual({ col: "vinculos", id: `${ELDER}_${CUIDADOR}` });
    expect(datos).toMatchObject({ elderUid: ELDER, cuidadorUid: CUIDADOR, codigo: "482917" });
    expect(batchDelete).toHaveBeenCalledWith({ col: "codigosVinculo", id: "482917" });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("rechaza un código mal escrito sin consultar Firestore", async () => {
    await expect(canjearCodigoVinculo(CUIDADOR, "12a4")).rejects.toBeInstanceOf(ErrorVinculo);
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it("rechaza un código inexistente o ya usado", async () => {
    getDocMock.mockResolvedValueOnce(noExiste);
    await expect(canjearCodigoVinculo(CUIDADOR, "482917")).rejects.toThrow("no existe");
  });

  it("rechaza un código vencido", async () => {
    getDocMock.mockResolvedValueOnce(docCodigo(enMinutos(-1)));
    await expect(canjearCodigoVinculo(CUIDADOR, "482917")).rejects.toThrow("venció");
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("avisa si ya estaba vinculado, sin escribir nada", async () => {
    getDocMock
      .mockResolvedValueOnce(docCodigo(enMinutos(10)))
      .mockResolvedValueOnce({ exists: () => true });
    await expect(canjearCodigoVinculo(CUIDADOR, "482917")).rejects.toThrow("Ya estás vinculado");
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
