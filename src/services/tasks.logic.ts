// Lógica pura (sin Firebase ni Capacitor) del checklist, adherencia y recordatorios.
// Todas las fechas "día" son strings locales "YYYY-MM-DD" para evitar problemas de zona horaria.

export type TaskCategory = "medicamento" | "cita" | "ejercicio" | "medicion" | "otro";

export type Recurrence =
  | { kind: "none" }
  | { kind: "daily" }
  | { kind: "weekly"; days: number[] } // 0 = domingo … 6 = sábado
  | { kind: "custom"; everyDays: number } // cada N días (N >= 2)
  | { kind: "hours"; everyHours: number }; // tratamiento cada N horas (ej. paracetamol cada 8 h)

/** Lo que completa el usuario en el formulario (la "serie"). */
export interface TaskDefinition {
  title: string;
  notes?: string;
  category: TaskCategory;
  time: string; // "HH:mm"
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // inclusive; si falta se usa el horizonte por defecto
  /** Hora de término "HH:mm". Obligatoria (junto con endDate) en tratamientos por horas. */
  endTime?: string;
  recurrence: Recurrence;
  /** Minutos antes de la hora para avisar. 0 = sin aviso previo. */
  remindBeforeMin: number;
  /** Avisar al día siguiente (09:00) si no fue marcada. */
  notifyMissed: boolean;
}

/** Una ocurrencia concreta (un documento en Firestore). */
export interface Task {
  id: string;
  elderUid: string;
  seriesId: string;
  title: string;
  notes?: string;
  category: TaskCategory;
  dueDate: string;
  time: string;
  remindBeforeMin: number;
  notifyMissed: boolean;
  status: "pending" | "done";
  completedAt?: Date;
  /** Quién creó la tarea. Las tareas anteriores a este campo no lo tienen. */
  creadoPor?: CreadoPor;
  /** Soft delete: la tarea se quitó pero el documento se conserva como historial. */
  eliminada?: boolean;
  /** Solo en tratamientos por horas: cada cuántas horas se repite. Su hora no se edita. */
  frecuenciaHoras?: number;
}

/** Momento de una ocurrencia: fecha + hora. Ordena y compara dosis del mismo día. */
export interface Momento {
  dueDate: string;
  time: string;
}

export interface CreadoPor {
  uid: string;
  rol: "elder" | "caregiver";
}

export const HORIZON_DAYS = 60;
export const MAX_SCHEDULED_NOTIFICATIONS = 60; // iOS permite 64 pendientes
export const MISSED_ALERT_HOUR = 9;

// ---------- fechas ----------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function diffDays(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Lunes de la semana de la fecha dada. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  return addDays(iso, -dow);
}

export function dueDateTime(dueDate: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = parseISODate(dueDate);
  d.setHours(h, m, 0, 0);
  return d;
}

// ---------- repetición ----------

/**
 * Fechas en que ocurre la serie, desde startDate hasta min(endDate, startDate+HORIZON).
 * Los tratamientos por horas no pasan por aquí: usan generarOcurrencias.
 */
export function generateOccurrenceDates(def: TaskDefinition, horizonDays = HORIZON_DAYS): string[] {
  const { startDate, recurrence } = def;
  if (recurrence.kind === "none") return [startDate];

  const hardEnd = addDays(startDate, horizonDays - 1);
  const end = def.endDate && def.endDate < hardEnd ? def.endDate : hardEnd;
  const total = diffDays(startDate, end);
  const out: string[] = [];

  for (let i = 0; i <= total; i++) {
    const date = addDays(startDate, i);
    if (recurrence.kind === "daily") {
      out.push(date);
    } else if (recurrence.kind === "weekly") {
      if (recurrence.days.includes(parseISODate(date).getDay())) out.push(date);
    } else if (recurrence.kind === "custom") {
      const every = Math.max(2, Math.floor(recurrence.everyDays));
      if (i % every === 0) out.push(date);
    }
  }
  return out;
}

export const MAX_FRECUENCIA_HORAS = 24;

/**
 * Ocurrencias (fecha + hora) de la serie. Para días usa la hora fija de la definición.
 * Para tratamientos por horas suma N horas reales desde la primera dosis hasta la fecha y
 * hora de término, sin pasar del horizonte (60 días desde la primera dosis).
 */
export function generarOcurrencias(def: TaskDefinition, horizonDays = HORIZON_DAYS): Momento[] {
  const { recurrence } = def;
  if (recurrence.kind !== "hours") {
    return generateOccurrenceDates(def, horizonDays).map((dueDate) => ({ dueDate, time: def.time }));
  }
  const inicio = dueDateTime(def.startDate, def.time).getTime();
  const tope = inicio + horizonDays * 86_400_000;
  const termino = def.endDate && def.endTime ? dueDateTime(def.endDate, def.endTime).getTime() : tope;
  const fin = Math.min(termino, tope - 1);
  const paso = Math.floor(recurrence.everyHours) * 3_600_000;
  const out: Momento[] = [];
  for (let t = inicio; t <= fin; t += paso) {
    const d = new Date(t);
    out.push({ dueDate: toISODate(d), time: horaDe(d) });
  }
  return out;
}

function horaDe(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function validateDefinition(def: TaskDefinition): string | null {
  if (!def.title.trim()) return "Escribe el nombre de la tarea";
  if (!/^\d{2}:\d{2}$/.test(def.time)) return "Indica la hora";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(def.startDate)) return "Indica la fecha de inicio";
  if (def.endDate && def.endDate < def.startDate) return "La fecha final no puede ser anterior al inicio";
  if (def.recurrence.kind === "weekly" && def.recurrence.days.length === 0) return "Elige al menos un día de la semana";
  if (def.recurrence.kind === "custom" && !(def.recurrence.everyDays >= 2)) return "La repetición personalizada debe ser cada 2 días o más";
  if (def.recurrence.kind === "hours") {
    const n = def.recurrence.everyHours;
    if (!Number.isInteger(n) || n < 1 || n > MAX_FRECUENCIA_HORAS) return "La frecuencia debe ser entre 1 y 24 horas";
    if (!def.endDate || !def.endTime || !/^\d{2}:\d{2}$/.test(def.endTime)) return "Indica la fecha y hora de término del tratamiento";
    if (dueDateTime(def.endDate, def.endTime) <= dueDateTime(def.startDate, def.time)) {
      return "El término debe ser posterior a la primera dosis";
    }
  }
  return null;
}

// ---------- progreso y adherencia ----------

export interface Progress {
  done: number;
  total: number;
  pct: number; // 0..100 entero
}

function pctOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Avance del checklist de un día: completadas / programadas ese día. */
export function computeDayProgress(tasks: Task[], dateISO: string): Progress {
  const day = tasks.filter((t) => t.dueDate === dateISO);
  const done = day.filter((t) => t.status === "done").length;
  return { done, total: day.length, pct: pctOf(done, day.length) };
}

/**
 * Adherencia en un rango [fromISO, toISO]: completadas / (completadas + vencidas).
 * Las pendientes cuya hora aún no llega NO cuentan (todavía no se incumplen).
 */
export function computeAdherence(tasks: Task[], fromISO: string, toISO: string, now: Date): Progress {
  let done = 0;
  let due = 0;
  for (const t of tasks) {
    if (t.dueDate < fromISO || t.dueDate > toISO) continue;
    if (t.status === "done") {
      done++;
      due++;
    } else if (dueDateTime(t.dueDate, t.time) <= now) {
      due++;
    }
  }
  return { done, total: due, pct: pctOf(done, due) };
}

/** Adherencia de la semana en curso (lunes → hoy). */
export function computeWeeklyAdherence(tasks: Task[], now: Date): Progress {
  const today = toISODate(now);
  return computeAdherence(tasks, startOfWeek(today), today, now);
}

// ---------- estado visual ----------

export type TaskState = "done" | "overdue" | "pending";

export function taskState(t: Task, now: Date): TaskState {
  if (t.status === "done") return "done";
  return dueDateTime(t.dueDate, t.time) < now ? "overdue" : "pending";
}

// ---------- plan de notificaciones locales ----------

export type NotificationKind = "reminder" | "missed";

export interface PlannedNotification {
  id: number;
  taskId: string;
  kind: NotificationKind;
  at: Date;
  title: string;
  body: string;
}

/** ID entero estable (positivo, 31 bits) a partir de taskId + tipo. Permite cancelar/reprogramar sin duplicar. */
export function notificationId(taskId: string, kind: NotificationKind): number {
  const s = `${taskId}:${kind}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647 || 1;
}

/**
 * Construye las notificaciones futuras a programar:
 *  - "reminder": remindBeforeMin antes de la hora (si es > 0 y todavía no pasó).
 *  - "missed": 09:00 del día siguiente si la tarea sigue pendiente y notifyMissed.
 * Se ordenan por fecha y se recortan al límite que soporta iOS.
 */
export function buildNotificationPlan(
  tasks: Task[],
  now: Date,
  limit = MAX_SCHEDULED_NOTIFICATIONS
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];

  for (const t of tasks) {
    if (t.status === "done") continue;
    const due = dueDateTime(t.dueDate, t.time);

    if (t.remindBeforeMin > 0) {
      const at = new Date(due.getTime() - t.remindBeforeMin * 60_000);
      if (at > now) {
        plan.push({
          id: notificationId(t.id, "reminder"),
          taskId: t.id,
          kind: "reminder",
          at,
          title: "Recordatorio",
          body: `${t.title} a las ${t.time}`,
        });
      }
    }

    if (t.notifyMissed) {
      const at = parseISODate(addDays(t.dueDate, 1));
      at.setHours(MISSED_ALERT_HOUR, 0, 0, 0);
      if (at > now) {
        plan.push({
          id: notificationId(t.id, "missed"),
          taskId: t.id,
          kind: "missed",
          at,
          title: "Tarea sin completar",
          body: `Ayer no marcaste: ${t.title}`,
        });
      }
    }
  }

  return plan.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}

// ---------- edición por el cuidador ----------

/**
 * Solo se pueden editar o quitar tareas pendientes: las completadas son el registro
 * de adherencia del estudio (OE2). Las reglas de Firestore aplican lo mismo al cuidador.
 */
export function esModificable(t: Pick<Task, "status">): boolean {
  return t.status === "pending";
}

/** Una tarea vigente es la que no fue quitada (soft delete). Las antiguas no tienen el campo. */
export function estaVigente(t: { eliminada?: boolean }): boolean {
  return t.eliminada !== true;
}

/** Clave ordenable "YYYY-MM-DD HH:mm". */
export function claveMomento(m: Momento): string {
  return `${m.dueDate} ${m.time}`;
}

/**
 * Ocurrencias vigentes y pendientes que se pueden modificar "desde esta en adelante".
 * Compara fecha y hora: en un tratamiento cada 8 h, desde la dosis de las 16:00 no
 * incluye la de las 08:00 del mismo día.
 */
export function ocurrenciasModificablesDesde<T extends Pick<Task, "dueDate" | "time" | "status" | "eliminada">>(
  ocurrencias: T[],
  desde: Momento
): T[] {
  const clave = claveMomento(desde);
  return ocurrencias.filter((o) => claveMomento(o) >= clave && esModificable(o) && estaVigente(o));
}

/** ¿Ya pasó su hora sin marcarse? */
export function estaAtrasada(t: Pick<Task, "status" | "dueDate" | "time">, now: Date): boolean {
  return t.status === "pending" && dueDateTime(t.dueDate, t.time) < now;
}

/**
 * Se puede quitar si está pendiente y su hora aún no llega. Las atrasadas sin marcar
 * quedan como no cumplidas en la adherencia (OE2); completarlas con atraso sí se permite.
 */
export function esQuitable(t: Pick<Task, "status" | "dueDate" | "time">, now: Date): boolean {
  return esModificable(t) && !estaAtrasada(t, now);
}

/** En los tratamientos por horas la hora no se edita: se quita la serie y se crea otra. */
export function esTratamientoPorHoras(t: Pick<Task, "frecuenciaHoras">): boolean {
  return (t.frecuenciaHoras ?? 0) > 0;
}

/**
 * Campos que se pueden cambiar al editar una tarea existente. Fecha y repetición no:
 * para eso se quita la tarea y se crea otra, así la serie nunca queda inconsistente.
 */
export interface CambiosTarea {
  title: string;
  notes?: string;
  category: TaskCategory;
  time: string;
  remindBeforeMin: number;
  notifyMissed: boolean;
}

export function validarCambios(c: CambiosTarea): string | null {
  if (!c.title.trim()) return "Escribe el nombre de la tarea";
  if (!/^\d{2}:\d{2}$/.test(c.time)) return "Indica la hora";
  return null;
}

/**
 * ¿Quedan ocurrencias pendientes de la misma serie después de esta? Sirve para mostrar
 * la opción "hoy y los días siguientes" solo cuando tiene sentido.
 */
export function tieneOcurrenciasSiguientes(
  tareas: Pick<Task, "seriesId" | "dueDate" | "time" | "status">[],
  tarea: Pick<Task, "seriesId" | "dueDate" | "time">
): boolean {
  const clave = claveMomento(tarea);
  return tareas.some(
    (t) => t.seriesId === tarea.seriesId && claveMomento(t) > clave && esModificable(t)
  );
}

/** Tareas de un día separadas para la vista del cuidador: pendientes (accionables) y completadas (solo lectura). */
export function agruparTareasDelDia(
  tareas: Task[],
  diaISO: string
): { pendientes: Task[]; completadas: Task[] } {
  const delDia = tareas
    .filter((t) => t.dueDate === diaISO)
    .sort((a, b) => a.time.localeCompare(b.time));
  return {
    pendientes: delDia.filter((t) => t.status === "pending"),
    completadas: delDia.filter((t) => t.status === "done"),
  };
}

/**
 * Tareas pendientes de mañana, para la sección "Próximas" (solo se ven, no se marcan).
 * Incluye las dosis de las 00:00, que pertenecen al día siguiente.
 */
export function tareasDeManana(tareas: Task[], hoyISO: string): Task[] {
  const manana = addDays(hoyISO, 1);
  return tareas
    .filter((t) => t.dueDate === manana && t.status === "pending" && estaVigente(t))
    .sort((a, b) => a.time.localeCompare(b.time));
}
