import {
  collection, doc, onSnapshot, orderBy, query, where, writeBatch, updateDoc, getDoc, getDocs, Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  generateOccurrenceDates, validateDefinition, validarCambios, ocurrenciasModificablesDesde,
  esModificable, estaVigente, addDays,
  type CambiosTarea, type CreadoPor, type Task, type TaskDefinition,
} from "./tasks.logic";

const COL = "tasks";

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
  const dates = generateOccurrenceDates(def);
  const batch = writeBatch(db);

  for (const dueDate of dates) {
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      elderUid,
      seriesId,
      title: def.title.trim(),
      notes: def.notes?.trim() ?? "",
      category: def.category,
      dueDate,
      time: def.time,
      remindBeforeMin: def.remindBeforeMin,
      notifyMissed: def.notifyMissed,
      status: "pending",
      createdAt: Timestamp.now(),
      ...(creadoPor ? { creadoPor } : {}),
    });
  }
  await batch.commit();
  return dates.length;
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

function camposDeCambios(c: CambiosTarea) {
  // nunca incluye status, completedAt ni elderUid: así el cuidador no choca con las reglas
  return {
    title: c.title.trim(),
    notes: c.notes?.trim() ?? "",
    category: c.category,
    time: c.time,
    remindBeforeMin: c.remindBeforeMin,
    notifyMissed: c.notifyMissed,
  };
}

/** Lee una ocurrencia y verifica que se pueda modificar (vigente y pendiente). */
async function ocurrenciaModificable(taskId: string) {
  const ref = doc(db, COL, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists() || !estaVigente(snap.data())) throw new ErrorTarea("La tarea ya no existe");
  if (!esModificable({ status: snap.data().status })) {
    throw new ErrorTarea("Las tareas completadas no se pueden modificar");
  }
  return ref;
}

/** Pendientes y vigentes de la serie desde una fecha. */
async function serieModificableDesde(elderUid: string, seriesId: string, fromISO: string) {
  const snap = await getDocs(
    query(collection(db, COL), where("elderUid", "==", elderUid), where("seriesId", "==", seriesId))
  );
  return ocurrenciasModificablesDesde(
    snap.docs.map((d) => ({
      ref: d.ref,
      dueDate: d.data().dueDate as string,
      status: d.data().status as Task["status"],
      eliminada: d.data().eliminada as boolean | undefined,
    })),
    fromISO
  );
}

/** Edita una sola ocurrencia (debe estar vigente y pendiente). */
export async function updateTask(taskId: string, cambios: CambiosTarea): Promise<void> {
  const err = validarCambios(cambios);
  if (err) throw new ErrorTarea(err);
  await updateDoc(await ocurrenciaModificable(taskId), camposDeCambios(cambios));
}

/** Edita esta ocurrencia y las siguientes de la serie, solo las pendientes. Devuelve cuántas cambió. */
export async function updateSeriesFrom(
  elderUid: string,
  seriesId: string,
  fromISO: string,
  cambios: CambiosTarea
): Promise<number> {
  const err = validarCambios(cambios);
  if (err) throw new ErrorTarea(err);
  const objetivo = await serieModificableDesde(elderUid, seriesId, fromISO);
  const batch = writeBatch(db);
  const campos = camposDeCambios(cambios);
  objetivo.forEach((o) => batch.update(o.ref, campos));
  await batch.commit();
  return objetivo.length;
}

function marcaQuitada(por: CreadoPor) {
  return { eliminada: true, eliminadaEn: Timestamp.now(), eliminadaPor: por };
}

/**
 * Quita una ocurrencia (soft delete): el documento se conserva marcado como eliminado.
 * Devuelve los ids afectados, para poder deshacer.
 */
export async function quitarTarea(taskId: string, por: CreadoPor): Promise<string[]> {
  const ref = await ocurrenciaModificable(taskId);
  await updateDoc(ref, marcaQuitada(por));
  return [ref.id];
}

/**
 * Quita esta ocurrencia y las siguientes de la serie (soft delete). Las completadas se
 * conservan intactas: son historial de adherencia. Devuelve los ids afectados.
 */
export async function quitarSerieDesde(
  elderUid: string,
  seriesId: string,
  fromISO: string,
  por: CreadoPor
): Promise<string[]> {
  const objetivo = await serieModificableDesde(elderUid, seriesId, fromISO);
  const batch = writeBatch(db);
  const marca = marcaQuitada(por);
  objetivo.forEach((o) => batch.update(o.ref, marca));
  await batch.commit();
  return objetivo.map((o) => o.ref.id);
}

/** Deshacer: vuelve a dejar vigentes las tareas quitadas. */
export async function restaurarTareas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, COL, id), { eliminada: false, eliminadaEn: null, eliminadaPor: null })
  );
  await batch.commit();
}

export { addDays };
