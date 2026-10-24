import {
  collection, doc, onSnapshot, orderBy, query, where, writeBatch, updateDoc, getDoc, getDocs, Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  generarOcurrencias, validateDefinition, validarCambios, ocurrenciasModificablesDesde,
  esModificable, estaVigente, estaAtrasada,
  type CambiosTarea, type CreadoPor, type Momento, type Task, type TaskDefinition,
} from "./tasks.logic";

const COL = "tasks";
/** Firestore acepta hasta 500 escrituras por lote; se deja margen. */
export const TAMANO_LOTE = 450;

const MSJ_ATRASADA = "Las tareas atrasadas no se pueden quitar: quedan registradas como no cumplidas";

/** Escribe en lotes de TAMANO_LOTE. Un tratamiento cada 4 h por 60 días son 360 documentos. */
async function escribirEnLotes<T>(items: T[], escribir: (batch: ReturnType<typeof writeBatch>, item: T) => void) {
  for (let i = 0; i < items.length; i += TAMANO_LOTE) {
    const batch = writeBatch(db);
    items.slice(i, i + TAMANO_LOTE).forEach((item) => escribir(batch, item));
    await batch.commit();
  }
}

/** Error con mensaje listo para mostrar al usuario. */
export class ErrorTarea extends Error {}

/**
 * Crea la serie materializada: un documento por ocurrencia (máx. 60 días).
 * `creadoPor` es opcional para no romper llamadas existentes; el cuidador siempre lo envía.
 */
export async function createTaskSeries(
  elderUid: string,
  def: TaskDefinition,
  creadoPor?: CreadoPor
): Promise<number> {
  if (!elderUid) throw new Error("elderUid requerido para crear tareas");
  const err = validateDefinition(def);
  if (err) throw new Error(err);

  const seriesId = doc(collection(db, COL)).id; // id aleatorio sin escribir
  const ocurrencias = generarOcurrencias(def);
  const frecuenciaHoras = def.recurrence.kind === "hours" ? def.recurrence.everyHours : undefined;

  await escribirEnLotes(ocurrencias, (batch, { dueDate, time }) => {
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      elderUid,
      seriesId,
      title: def.title.trim(),
      notes: def.notes?.trim() ?? "",
      category: def.category,
      dueDate,
      time,
      remindBeforeMin: def.remindBeforeMin,
      notifyMissed: def.notifyMissed,
      status: "pending",
      createdAt: Timestamp.now(),
      ...(creadoPor ? { creadoPor } : {}),
      ...(frecuenciaHoras ? { frecuenciaHoras } : {}),
    });
  });
  return ocurrencias.length;
}

/**
 * Escucha en vivo las tareas VIGENTES en [fromISO, toISO]. Requiere índice compuesto elderUid + dueDate.
 * Las quitadas (soft delete) se descartan aquí, en un solo lugar: así checklist, adherencia,
 * calendario y recordatorios nunca las ven. Se filtra en el cliente y no en la consulta porque
 * `where("eliminada", "==", false)` excluiría las tareas antiguas, que no tienen el campo.
 */
export function subscribeTasks(
  elderUid: string,
  fromISO: string,
  toISO: string,
  onData: (tasks: Task[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("elderUid", "==", elderUid),
    where("dueDate", ">=", fromISO),
    where("dueDate", "<=", toISO),
    orderBy("dueDate", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const tasks: Task[] = snap.docs
        .filter((d) => estaVigente(d.data()))
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            elderUid: x.elderUid,
            seriesId: x.seriesId ?? d.id,
            title: x.title,
            notes: x.notes || undefined,
            category: x.category ?? "otro",
            dueDate: x.dueDate,
            time: x.time,
            remindBeforeMin: x.remindBeforeMin ?? 0,
            notifyMissed: x.notifyMissed ?? false,
            status: x.status === "done" ? "done" : "pending",
            completedAt: x.completedAt ? (x.completedAt as Timestamp).toDate() : undefined,
            creadoPor: x.creadoPor ?? undefined,
            frecuenciaHoras: x.frecuenciaHoras ?? undefined,
          };
        });
      tasks.sort((a, b) => (a.dueDate + a.time).localeCompare(b.dueDate + b.time));
      onData(tasks);
    },
    (e) => onError?.(e)
  );
}

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, COL, taskId), {
    status: done ? "done" : "pending",
    completedAt: done ? Timestamp.now() : null,
  });
}

/**
 * Campos a escribir al editar. Nunca incluye status, completedAt ni elderUid (así el cuidador
 * no choca con las reglas). En tratamientos por horas tampoco la hora: cada dosis tiene la suya.
 */
function camposDeCambios(c: CambiosTarea, porHoras: boolean) {
  return {
    title: c.title.trim(),
    notes: c.notes?.trim() ?? "",
    category: c.category,
    ...(porHoras ? {} : { time: c.time }),
    remindBeforeMin: c.remindBeforeMin,
    notifyMissed: c.notifyMissed,
  };
}

/** Lee una ocurrencia y verifica que se pueda modificar (vigente y pendiente). */
async function ocurrenciaModificable(taskId: string) {
  const ref = doc(db, COL, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists() || !estaVigente(snap.data())) throw new ErrorTarea("La tarea ya no existe");
  const x = snap.data();
  if (!esModificable({ status: x.status })) {
    throw new ErrorTarea("Las tareas completadas no se pueden modificar");
  }
  return { ref, dueDate: x.dueDate as string, time: x.time as string, porHoras: (x.frecuenciaHoras ?? 0) > 0 };
}

/** Pendientes y vigentes de la serie desde un momento (fecha + hora). */
async function serieModificableDesde(elderUid: string, seriesId: string, desde: Momento) {
  const snap = await getDocs(
    query(collection(db, COL), where("elderUid", "==", elderUid), where("seriesId", "==", seriesId))
  );
  return ocurrenciasModificablesDesde(
    snap.docs.map((d) => ({
      ref: d.ref,
      dueDate: d.data().dueDate as string,
      time: d.data().time as string,
      status: d.data().status as Task["status"],
      eliminada: d.data().eliminada as boolean | undefined,
      porHoras: (d.data().frecuenciaHoras ?? 0) > 0,
    })),
    desde
  );
}

/** Edita una sola ocurrencia (debe estar vigente y pendiente). */
export async function updateTask(taskId: string, cambios: CambiosTarea): Promise<void> {
  const err = validarCambios(cambios);
  if (err) throw new ErrorTarea(err);
  const o = await ocurrenciaModificable(taskId);
  await updateDoc(o.ref, camposDeCambios(cambios, o.porHoras));
}

/** Edita esta ocurrencia y las siguientes de la serie, solo las pendientes. Devuelve cuántas cambió. */
export async function updateSeriesFrom(
  elderUid: string,
  seriesId: string,
  desde: Momento,
  cambios: CambiosTarea
): Promise<number> {
  const err = validarCambios(cambios);
  if (err) throw new ErrorTarea(err);
  const objetivo = await serieModificableDesde(elderUid, seriesId, desde);
  await escribirEnLotes(objetivo, (batch, o) => batch.update(o.ref, camposDeCambios(cambios, o.porHoras)));
  return objetivo.length;
}

function marcaQuitada(por: CreadoPor) {
  return { eliminada: true, eliminadaEn: Timestamp.now(), eliminadaPor: por };
}

/**
 * Quita una ocurrencia (soft delete): el documento se conserva marcado como eliminado.
 * No se puede quitar una atrasada sin marcar: queda como no cumplida (OE2).
 * Devuelve los ids afectados, para poder deshacer.
 */
export async function quitarTarea(taskId: string, por: CreadoPor, ahora = new Date()): Promise<string[]> {
  const o = await ocurrenciaModificable(taskId);
  if (estaAtrasada({ status: "pending", dueDate: o.dueDate, time: o.time }, ahora)) {
    throw new ErrorTarea(MSJ_ATRASADA);
  }
  await updateDoc(o.ref, marcaQuitada(por));
  return [o.ref.id];
}

/**
 * Quita esta ocurrencia y las siguientes de la serie (soft delete). Las completadas y las
 * atrasadas sin marcar se conservan intactas: son historial de adherencia. Devuelve los ids afectados.
 */
export async function quitarSerieDesde(
  elderUid: string,
  seriesId: string,
  desde: Momento,
  por: CreadoPor,
  ahora = new Date()
): Promise<string[]> {
  const objetivo = (await serieModificableDesde(elderUid, seriesId, desde)).filter((o) => !estaAtrasada(o, ahora));
  if (objetivo.length === 0) throw new ErrorTarea(MSJ_ATRASADA);
  const marca = marcaQuitada(por);
  await escribirEnLotes(objetivo, (batch, o) => batch.update(o.ref, marca));
  return objetivo.map((o) => o.ref.id);
}

/** Deshacer: vuelve a dejar vigentes las tareas quitadas. */
export async function restaurarTareas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await escribirEnLotes(ids, (batch, id) =>
    batch.update(doc(db, COL, id), { eliminada: false, eliminadaEn: null, eliminadaPor: null })
  );
}
