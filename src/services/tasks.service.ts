import {
  collection, doc, onSnapshot, orderBy, query, where, writeBatch, updateDoc, getDocs, Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  generateOccurrenceDates, validateDefinition, addDays,
  type Task, type TaskDefinition,
} from "./tasks.logic";

const COL = "tasks";

/** Crea la serie materializada: un documento por ocurrencia (máx. 60 días). */
export async function createTaskSeries(elderUid: string, def: TaskDefinition): Promise<number> {
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
    });
  }
  await batch.commit();
  return dates.length;
}

/** Escucha en vivo las tareas en [fromISO, toISO]. Requiere índice compuesto elderUid + dueDate. */
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
      const tasks: Task[] = snap.docs.map((d) => {
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

export async function deleteTask(taskId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, taskId));
  await batch.commit();
}

/** Borra esta ocurrencia y las siguientes de la misma serie. */
export async function deleteSeriesFrom(elderUid: string, seriesId: string, fromISO: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, COL), where("elderUid", "==", elderUid), where("seriesId", "==", seriesId))
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    if ((d.data().dueDate as string) >= fromISO) batch.delete(d.ref);
  });
  await batch.commit();
}

export { addDays };
