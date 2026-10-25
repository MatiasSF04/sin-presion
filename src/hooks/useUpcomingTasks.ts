import { useEffect, useMemo, useState } from "react";
import { subscribeTasks } from "../services/tasks.service";
import { syncReminders } from "../services/reminders.service";
import { registrarError } from "../services/errores.service";
import { addDays, startOfWeek, toISODate, HORIZON_DAYS, type Task } from "../services/tasks.logic";

/** Resultado de la última respuesta de Firestore, junto con la consulta que la produjo. */
interface Respuesta {
  clave: string;
  tasks: Task[];
  error: string | null;
}

/**
 * Una sola suscripción compartida: desde min(ayer, lunes) hasta hoy+HORIZON.
 * Cubre checklist de hoy, adherencia semanal, calendario y avisos "no cumplido" (día anterior).
 * Cada cambio reprograma las notificaciones locales con la misma lista, salvo que se
 * desactive con `programarRecordatorios: false` (vista del cuidador: los recordatorios
 * son del adulto mayor y no deben sonar en el teléfono del cuidador).
 *
 * El estado "cargando" no se guarda: se deriva comparando la consulta actual con la de la
 * última respuesta. Así el efecto solo actualiza estado desde los callbacks de Firestore.
 */
export function useUpcomingTasks(
  elderUid: string | undefined,
  { programarRecordatorios = true }: { programarRecordatorios?: boolean } = {}
) {
  const today = toISODate(new Date());
  const from = useMemo(() => {
    const yesterday = addDays(today, -1);
    const monday = startOfWeek(today);
    return yesterday < monday ? yesterday : monday;
  }, [today]);
  const to = useMemo(() => addDays(today, HORIZON_DAYS + 2), [today]);

  const clave = elderUid ? `${elderUid}|${from}|${to}` : null;
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!elderUid || !clave) return;
    return subscribeTasks(
      elderUid,
      from,
      to,
      (list) => {
        setRespuesta({ clave, tasks: list, error: null });
        if (programarRecordatorios) {
          syncReminders(list).catch((e) => registrarError("recordatorios.programar", e));
        }
      },
      (e) => setRespuesta({ clave, tasks: [], error: e.message })
    );
  }, [elderUid, from, to, clave, programarRecordatorios]);

  if (!clave) return { tasks: [] as Task[], loading: false, error: null };

  const vigente = respuesta?.clave === clave;
  return {
    tasks: vigente ? respuesta.tasks : [],
    loading: !vigente,
    error: vigente ? respuesta.error : null,
  };
}
