import { useEffect, useMemo, useState } from "react";
import { subscribeTasks } from "../services/tasks.service";
import { syncReminders } from "../services/reminders.service";
import { addDays, startOfWeek, toISODate, HORIZON_DAYS, type Task } from "../services/tasks.logic";

/**
 * Una sola suscripción compartida: desde min(ayer, lunes) hasta hoy+HORIZON.
 * Cubre checklist de hoy, adherencia semanal, calendario y avisos "no cumplido" (día anterior).
 * Cada cambio reprograma las notificaciones locales con la misma lista.
 */
export function useUpcomingTasks(elderUid: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = toISODate(new Date());
  const from = useMemo(() => {
    const yesterday = addDays(today, -1);
    const monday = startOfWeek(today);
    return yesterday < monday ? yesterday : monday;
  }, [today]);
  const to = useMemo(() => addDays(today, HORIZON_DAYS + 2), [today]);

  useEffect(() => {
    if (!elderUid) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTasks(
      elderUid,
      from,
      to,
      (list) => {
        setTasks(list);
        setLoading(false);
        setError(null);
        syncReminders(list).catch((e) => console.warn("No se pudieron programar recordatorios", e));
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [elderUid, from, to]);

  return { tasks, loading, error };
}
