/**
 * Pruebas automáticas de sos.service: registro del uso del botón y lectura para el cuidador.
 * Firestore se reemplaza por mocks (sin red ni base real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const addDocMock = vi.fn();
const onSnapshotMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, col: string) => ({ col })),
  addDoc: (...a: unknown[]) => addDocMock(...a),
  onSnapshot: (...a: unknown[]) => onSnapshotMock(...a),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(),
  serverTimestamp: () => "__AHORA__",
}));
vi.mock("./firebase", () => ({ db: {} }));

import { escucharSos, registrarSos } from "./sos.service";
import type { EventoSos } from "./sos.logic";

beforeEach(() => {
  addDocMock.mockReset();
  addDocMock.mockResolvedValue({ id: "sos-1" });
  onSnapshotMock.mockReset();
});

describe("registrarSos", () => {
  it("guarda en sosEvents quién, a qué número y cuándo", async () => {
    await registrarSos("uid-adulto", { nombre: "Ana", telefono: "+56912345678", esContacto: true });
    expect(addDocMock).toHaveBeenCalledWith(
      { col: "sosEvents" },
      { elderUid: "uid-adulto", telefono: "+56912345678", nombreContacto: "Ana", esContacto: true, creadoEn: "__AHORA__" }
    );
  });

  it("no escribe sin elderUid", async () => {
    await expect(registrarSos("", { nombre: "SAMU", telefono: "131", esContacto: false })).rejects.toThrow();
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

describe("escucharSos", () => {
  it("entrega los eventos con su fecha", () => {
    const recibidos: EventoSos[] = [];
    escucharSos("uid-adulto", (e) => recibidos.push(...e), () => undefined);
    const fecha = new Date(2026, 9, 24, 2, 50);
    const onNext = onSnapshotMock.mock.calls[0][1] as (snap: unknown) => void;
    onNext({
      docs: [
        {
          id: "sos-1",
          data: () => ({
            elderUid: "uid-adulto", telefono: "131", nombreContacto: "SAMU", esContacto: false,
            creadoEn: { toDate: () => fecha },
          }),
        },
      ],
    });
    expect(recibidos).toEqual([
      { id: "sos-1", elderUid: "uid-adulto", telefono: "131", nombreContacto: "SAMU", esContacto: false, creadoEn: fecha },
    ]);
  });
});
