/**
 * Pruebas automáticas de tasks.service: creación con autor, filtro de tareas quitadas,
 * edición, quitar (soft delete) y deshacer. Firestore se reemplaza por mocks (sin red ni base real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();
const getDocsMock = vi.fn();
const getDocMock = vi.fn();
const updateDocMock = vi.fn();
const onSnapshotMock = vi.fn();
let contadorIds = 0;

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ col: "tasks" })),
  doc: vi.fn((_ref: unknown, _col?: string, id?: string) => ({ id: id ?? `nuevo-${++contadorIds}` })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (...a: unknown[]) => onSnapshotMock(...a),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getDoc: (...a: unknown[]) => getDocMock(...a),
  updateDoc: (...a: unknown[]) => updateDocMock(...a),
  writeBatch: () => ({ set: batchSet, update: batchUpdate, commit: batchCommit }),
  Timestamp: { now: () => "__AHORA__" },
}));
vi.mock("./firebase", () => ({ db: {} }));

import {
  createTaskSeries, quitarSerieDesde, quitarTarea, restaurarTareas, subscribeTasks,
  updateSeriesFrom, updateTask, ErrorTarea,
} from "./tasks.service";
import type { CambiosTarea, CreadoPor, Task, TaskDefinition } from "./tasks.logic";

const ELDER = "uid-adulto";
const CUIDADOR: CreadoPor = { uid: "uid-cuidador", rol: "caregiver" };
const def: TaskDefinition = {
  title: "Control cardiología",
  category: "cita",
  time: "10:30",
  startDate: "2026-10-14",
  recurrence: { kind: "none" },
  remindBeforeMin: 60,
  notifyMissed: true,
};
/** "Ahora" fijo de las pruebas: antes de las 08:00 del 12-oct, así esas tareas aún no están atrasadas. */
const AHORA = new Date(2026, 9, 12, 7, 0);
const DESDE = { dueDate: "2026-10-12", time: "08:00" };

const cambios: CambiosTarea = {
  title: "Losartán 100 mg",
  category: "medicamento",
  time: "09:00",
  remindBeforeMin: 15,
  notifyMissed: true,
};

/** Documento de Firestore simulado. */
const docFs = (id: string, dueDate: string, status: "pending" | "done", extra: object = {}) => ({
  id,
  ref: { id },
  exists: () => true,
  data: () => ({ elderUid: ELDER, seriesId: "s1", dueDate, time: "08:00", status, title: "Losartán", ...extra }),
});

beforeEach(() => {
  [batchSet, batchUpdate, batchCommit, getDocsMock, getDocMock, updateDocMock, onSnapshotMock].forEach((m) =>
    m.mockReset()
  );
  batchCommit.mockResolvedValue(undefined);
});

describe("createTaskSeries", () => {
  it("guarda quién creó la tarea cuando se indica", async () => {
    await createTaskSeries(ELDER, def, CUIDADOR);
    expect(batchSet.mock.calls[0][1].creadoPor).toEqual(CUIDADOR);
  });

  it("sin autor sigue funcionando como antes (no agrega el campo)", async () => {
    await createTaskSeries(ELDER, def);
    expect(batchSet.mock.calls[0][1]).not.toHaveProperty("creadoPor");
  });
});

describe("subscribeTasks", () => {
  it("entrega solo las tareas vigentes: descarta las quitadas y conserva las antiguas sin el campo", () => {
    let recibidas: Task[] = [];
    onSnapshotMock.mockImplementation((_q, alRecibir: (s: unknown) => void) => {
      alRecibir({
        docs: [
          docFs("antigua", "2026-10-12", "pending"),
          docFs("quitada", "2026-10-12", "pending", { eliminada: true }),
          docFs("restaurada", "2026-10-12", "pending", { eliminada: false }),
        ],
      });
      return () => {};
    });
    subscribeTasks(ELDER, "2026-10-12", "2026-10-12", (t) => (recibidas = t));
    expect(recibidas.map((t) => t.id).sort()).toEqual(["antigua", "restaurada"]);
  });
});

describe("edición", () => {
  it("updateTask nunca envía status, completedAt ni elderUid", async () => {
    getDocMock.mockResolvedValue(docFs("t1", "2026-10-12", "pending"));
    await updateTask("t1", cambios);
    const campos = updateDocMock.mock.calls[0][1];
    expect(campos).not.toHaveProperty("status");
    expect(campos).not.toHaveProperty("completedAt");
    expect(campos).not.toHaveProperty("elderUid");
    expect(campos.title).toBe("Losartán 100 mg");
  });

  it("updateTask rechaza una tarea completada sin escribir", async () => {
    getDocMock.mockResolvedValue(docFs("t1", "2026-10-12", "done"));
    await expect(updateTask("t1", cambios)).rejects.toBeInstanceOf(ErrorTarea);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("updateTask rechaza cambios inválidos sin consultar ni escribir", async () => {
    await expect(updateTask("t1", { ...cambios, title: "" })).rejects.toBeInstanceOf(ErrorTarea);
    expect(getDocMock).not.toHaveBeenCalled();
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("updateSeriesFrom solo modifica las pendientes vigentes desde la fecha", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        docFs("a", "2026-10-11", "pending"),
        docFs("b", "2026-10-12", "done"),
        docFs("c", "2026-10-12", "pending"),
        docFs("x", "2026-10-13", "pending", { eliminada: true }),
      ],
    });
    await expect(updateSeriesFrom(ELDER, "s1", DESDE, cambios)).resolves.toBe(1);
    expect(batchUpdate.mock.calls.map((c) => c[0].id)).toEqual(["c"]);
  });
});

describe("quitar (soft delete) y deshacer", () => {
  it("quitarTarea marca la tarea como eliminada con fecha y autor, sin borrarla", async () => {
    getDocMock.mockResolvedValue(docFs("c", "2026-10-12", "pending"));
    await expect(quitarTarea("c", CUIDADOR, AHORA)).resolves.toEqual(["c"]);
    expect(updateDocMock).toHaveBeenCalledWith(
      { id: "c" },
      { eliminada: true, eliminadaEn: "__AHORA__", eliminadaPor: CUIDADOR }
    );
  });

  it("quitarTarea rechaza una tarea completada", async () => {
    getDocMock.mockResolvedValue(docFs("b", "2026-10-12", "done"));
    await expect(quitarTarea("b", CUIDADOR, AHORA)).rejects.toThrow("completadas");
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("quitarSerieDesde marca solo las pendientes vigentes y conserva las completadas", async () => {
    getDocsMock.mockResolvedValue({
      docs: [docFs("b", "2026-10-12", "done"), docFs("c", "2026-10-12", "pending"), docFs("d", "2026-10-13", "pending")],
    });
    await expect(quitarSerieDesde(ELDER, "s1", DESDE, CUIDADOR, AHORA)).resolves.toEqual(["c", "d"]);
    expect(batchUpdate.mock.calls.map((c) => c[0].id)).toEqual(["c", "d"]);
    expect(batchUpdate.mock.calls[0][1]).toMatchObject({ eliminada: true, eliminadaPor: CUIDADOR });
  });

  it("restaurarTareas vuelve a dejar vigentes las tareas quitadas", async () => {
    await restaurarTareas(["c", "d"]);
    expect(batchUpdate).toHaveBeenCalledWith({ id: "c" }, { eliminada: false, eliminadaEn: null, eliminadaPor: null });
    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("restaurarTareas sin ids no escribe nada", async () => {
    await restaurarTareas([]);
    expect(batchCommit).not.toHaveBeenCalled();
  });
});

describe("tratamientos por horas (5a)", () => {
  const paracetamol: TaskDefinition = {
    title: "Paracetamol 500 mg",
    category: "medicamento",
    time: "08:00",
    startDate: "2026-10-14",
    endDate: "2026-10-15",
    endTime: "00:00",
    recurrence: { kind: "hours", everyHours: 8 },
    remindBeforeMin: 0,
    notifyMissed: false,
  };

  it("crea una dosis por documento, cada una con su hora y la frecuencia", async () => {
    await expect(createTaskSeries(ELDER, paracetamol)).resolves.toBe(3);
    const docs = batchSet.mock.calls.map((c) => c[1]);
    expect(docs.map((d) => `${d.dueDate} ${d.time}`)).toEqual(["2026-10-14 08:00", "2026-10-14 16:00", "2026-10-15 00:00"]);
    expect(docs.every((d) => d.frecuenciaHoras === 8)).toBe(true);
  });

  it("las series por días no guardan frecuenciaHoras", async () => {
    await createTaskSeries(ELDER, def);
    expect(batchSet.mock.calls[0][1]).not.toHaveProperty("frecuenciaHoras");
  });

  it("escribe en varios lotes cuando hay más de 450 dosis (cada 2 h por 60 días = 720)", async () => {
    const n = await createTaskSeries(ELDER, {
      ...paracetamol,
      recurrence: { kind: "hours", everyHours: 2 },
      endDate: "2027-01-31",
      endTime: "08:00",
    });
    expect(n).toBe(720);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });

  it("al editar una dosis no cambia su hora; en las series por días sí", async () => {
    getDocMock.mockResolvedValue(docFs("t1", "2026-10-12", "pending", { frecuenciaHoras: 8 }));
    await updateTask("t1", cambios);
    expect(updateDocMock.mock.calls[0][1]).not.toHaveProperty("time");

    getDocMock.mockResolvedValue(docFs("t2", "2026-10-12", "pending"));
    await updateTask("t2", cambios);
    expect(updateDocMock.mock.calls[1][1].time).toBe("09:00");
  });

  it("'esta y las siguientes' cuenta desde la hora de la dosis, no desde el inicio del día", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        docFs("d08", "2026-10-12", "pending", { time: "08:00", frecuenciaHoras: 8 }),
        docFs("d16", "2026-10-12", "pending", { time: "16:00", frecuenciaHoras: 8 }),
        docFs("d00", "2026-10-13", "pending", { time: "00:00", frecuenciaHoras: 8 }),
      ],
    });
    await expect(updateSeriesFrom(ELDER, "s1", { dueDate: "2026-10-12", time: "16:00" }, cambios)).resolves.toBe(2);
    expect(batchUpdate.mock.calls.map((c) => c[0].id)).toEqual(["d16", "d00"]);
    expect(batchUpdate.mock.calls[0][1]).not.toHaveProperty("time");
  });
});

describe("no se quitan las atrasadas sin marcar (OE2)", () => {
  const MEDIODIA = new Date(2026, 9, 12, 12, 0);

  it("quitarTarea rechaza una atrasada sin escribir", async () => {
    getDocMock.mockResolvedValue(docFs("c", "2026-10-12", "pending")); // 08:00, ya pasó
    await expect(quitarTarea("c", CUIDADOR, MEDIODIA)).rejects.toThrow("atrasadas");
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("quitarSerieDesde salta las atrasadas y quita solo las futuras", async () => {
    getDocsMock.mockResolvedValue({
      docs: [docFs("c", "2026-10-12", "pending"), docFs("d", "2026-10-13", "pending")],
    });
    await expect(quitarSerieDesde(ELDER, "s1", DESDE, CUIDADOR, MEDIODIA)).resolves.toEqual(["d"]);
  });

  it("quitarSerieDesde avisa si no queda ninguna futura para quitar", async () => {
    getDocsMock.mockResolvedValue({ docs: [docFs("c", "2026-10-12", "pending")] });
    await expect(quitarSerieDesde(ELDER, "s1", DESDE, CUIDADOR, MEDIODIA)).rejects.toBeInstanceOf(ErrorTarea);
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
