import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "../../context/AuthContext";
import { colors, radius } from "../../styles/theme";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { TaskForm } from "../../components/tasks/TaskForm";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { createTaskSeries, setTaskDone, deleteTask, deleteSeriesFrom } from "../../services/tasks.service";
import { computeDayProgress, computeWeeklyAdherence, taskState, toISODate, type TaskDefinition } from "../../services/tasks.logic";

export function TasksPage() {
  const { appUser } = useAuth();
  const elderUid = appUser?.uid;
  const { tasks, loading, error } = useUpcomingTasks(elderUid);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());
  const [busyId, setBusyId] = useState<string | null>(null);

  // refresca estados (vencida/pendiente) cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = toISODate(now);
  const todays = tasks.filter((t) => t.dueDate === today);
  const progress = computeDayProgress(tasks, today);
  const weekly = computeWeeklyAdherence(tasks, now);

  async function handleCreate(def: TaskDefinition) {
    if (!elderUid) throw new Error("Sesión no iniciada");
    await createTaskSeries(elderUid, def);
    setShowForm(false);
  }

  async function toggle(id: string, done: boolean) {
    setBusyId(id);
    try {
      await setTaskDone(id, !done);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, seriesId: string, dueDate: string) {
    if (!elderUid) return;
    // eslint-disable-next-line no-alert
    const all = window.confirm("¿Eliminar también las repeticiones siguientes?\nAceptar = esta y las siguientes · Cancelar = solo esta");
    if (all) await deleteSeriesFrom(elderUid, seriesId, dueDate);
    else await deleteTask(id);
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Tareas de hoy</h1>

      <ReminderBanner tasks={todays} now={now} onGo={() => undefined} />

      <div style={s.summary}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
          <strong>{progress.done} de {progress.total} completadas</strong>
          <span>{progress.pct}%</span>
        </div>
        <div style={s.barBg}><div style={{ ...s.barFill, width: `${progress.pct}%` }} /></div>
        <p style={s.adh}>
          Adherencia de la semana:{" "}
          <strong style={{ color: weekly.pct >= 80 ? colors.success : colors.warning }}>
            {weekly.total === 0 ? "sin datos aún" : `${weekly.pct}% (${weekly.done}/${weekly.total})`}
          </strong>
        </p>
      </div>

      {error && <p style={{ color: colors.emergency }}>No se pudieron cargar las tareas: {error}</p>}
      {loading && <p style={{ color: colors.textSecondary }}>Cargando…</p>}
      {!loading && todays.length === 0 && <p style={{ color: colors.textSecondary }}>No tienes tareas para hoy.</p>}

      {todays.map((t) => {
        const st = taskState(t, now);
        const done = st === "done";
        return (
          <div key={t.id} style={{ ...s.item, borderColor: st === "overdue" ? colors.emergency : colors.border }}>
            <button
              aria-label={done ? "Desmarcar" : "Marcar como hecha"}
              disabled={busyId === t.id}
              onClick={() => toggle(t.id, done)}
              style={{ ...s.check, background: done ? colors.success : colors.background, borderColor: done ? colors.success : colors.border }}
            >
              {done ? "✓" : ""}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? colors.textSecondary : colors.textPrimary }}>
                {t.title}
              </div>
              <div style={{ fontSize: 14, color: st === "overdue" ? colors.emergency : colors.textSecondary }}>
                {t.time}{st === "overdue" ? " · sin marcar" : ""}
              </div>
            </div>
            <button aria-label="Eliminar" onClick={() => remove(t.id, t.seriesId, t.dueDate)} style={s.del}>🗑</button>
          </div>
        );
      })}

      {showForm ? (
        <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <button style={s.add} onClick={() => setShowForm(true)}>+ Agregar tarea</button>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: 20, maxWidth: 520, margin: "0 auto", paddingBottom: 100 },
  h1: { fontSize: 26, margin: "0 0 16px", color: colors.textPrimary },
  summary: { background: colors.surfaceMuted, borderRadius: radius.card, padding: 16, marginBottom: 16 },
  barBg: { height: 10, background: colors.border, borderRadius: 5, marginTop: 10, overflow: "hidden" },
  barFill: { height: "100%", background: colors.success, transition: "width .3s" },
  adh: { margin: "12px 0 0", fontSize: 15, color: colors.textSecondary },
  item: { display: "flex", alignItems: "center", gap: 14, padding: 14, marginBottom: 10, background: colors.background, border: `1.5px solid ${colors.border}`, borderRadius: radius.card },
  check: { width: 44, height: 44, borderRadius: 22, border: "2px solid", color: "#fff", fontSize: 24, cursor: "pointer", flexShrink: 0 },
  del: { background: "none", border: "none", fontSize: 18, cursor: "pointer", opacity: 0.6 },
  add: { width: "100%", padding: 16, borderRadius: radius.button, border: `2px dashed ${colors.primary}`, background: colors.primaryLight, color: colors.primary, fontSize: 17, fontWeight: 600, cursor: "pointer" },
};
