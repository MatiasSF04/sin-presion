import { unirClases } from "../../estilos/unirClases";
import s from "./ReminderBanner.module.css";
import { dueDateTime, type Task } from "../../services/tasks.logic";

interface Props {
  tasks: Task[];
  now: Date;
  onGo: () => void;
}

/**
 * Aviso dentro de la app (respaldo en navegador y refuerzo en nativo):
 * tareas de hoy vencidas, o que vencen dentro de su ventana de recordatorio.
 */
export function ReminderBanner({ tasks, now, onGo }: Props) {
  const active = tasks.filter((t) => {
    if (t.status === "done") return false;
    const due = dueDateTime(t.dueDate, t.time).getTime();
    const start = due - Math.max(t.remindBeforeMin, 0) * 60_000;
    const sameDay = due >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() &&
      due < new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return sameDay && now.getTime() >= start;
  });
  if (active.length === 0) return null;

  const overdue = active.filter((t) => dueDateTime(t.dueDate, t.time) < now).length;

  return (
    <button
      type="button"
      onClick={onGo}
      className={unirClases(s.aviso, overdue > 0 ? s.vencidas : s.proximas)}
    >
      <span aria-hidden="true">🔔 </span>
      {overdue > 0 ? `${overdue} tarea(s) sin marcar` : `${active.length} tarea(s) próximas`} — toca para completar
    </button>
  );
}
