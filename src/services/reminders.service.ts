import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { buildNotificationPlan, type Task } from "./tasks.logic";

/** Las notificaciones locales solo existen en la app nativa; en navegador se usa el ReminderBanner. */
export const remindersSupported = (): boolean => Capacitor.isNativePlatform();

export async function ensureReminderPermission(): Promise<boolean> {
  if (!remindersSupported()) return false;
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === "granted") return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

/**
 * Reemplaza todo lo programado por el plan actual (cancelar + programar).
 * Es idempotente: los IDs son determinísticos, así que no se duplican avisos.
 */
export async function syncReminders(tasks: Task[], now: Date = new Date()): Promise<number> {
  if (!remindersSupported()) return 0;
  if (!(await ensureReminderPermission())) return 0;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const plan = buildNotificationPlan(tasks, now);
  if (plan.length === 0) return 0;

  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      schedule: { at: p.at, allowWhileIdle: true },
      extra: { taskId: p.taskId, kind: p.kind },
    })),
  });
  return plan.length;
}

/** Cancela todos los recordatorios programados en este teléfono (al cerrar sesión). */
export async function cancelarRecordatorios(): Promise<void> {
  if (!remindersSupported()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
}

/** Al tocar una notificación se abre el checklist para completar la tarea. */
export function onReminderTapped(handler: (taskId: string) => void): () => void {
  if (!remindersSupported()) return () => {};
  let remove: (() => void) | undefined;
  let cancelled = false;
  void LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
    const id = ev.notification.extra?.taskId as string | undefined;
    if (id) handler(id);
  }).then((h) => {
    if (cancelled) void h.remove();
    else remove = () => void h.remove();
  });
  return () => {
    cancelled = true;
    remove?.();
  };
}
