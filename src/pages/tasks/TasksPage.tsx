import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { TaskForm } from "../../components/tasks/TaskForm";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { unirClases } from "../../estilos/unirClases";
import s from "./TasksPage.module.css";
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
    const all = window.confirm("¿Eliminar también las repeticiones siguientes?\nAceptar = esta y las siguientes · Cancelar = solo esta");
    if (all) await deleteSeriesFrom(elderUid, seriesId, dueDate);
    else await deleteTask(id);
  }

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Tareas de hoy" volverA="/home" />

      <ReminderBanner tasks={todays} now={now} onGo={() => undefined} />

      <Tarjeta variante="suave">
        <div className={s.resumenFila}>
          <strong>{progress.done} de {progress.total} completadas</strong>
          <span>{progress.pct}%</span>
        </div>
        <div className={s.barra}>
          <BarraProgreso porcentaje={progress.pct} etiqueta="Tareas completadas hoy" />
        </div>
        <p className={s.adherencia}>
          Adherencia de la semana:{" "}
          <strong className={weekly.pct >= 80 ? s.adherenciaBuena : s.adherenciaBaja}>
            {weekly.total === 0 ? "sin datos aún" : `${weekly.pct}% (${weekly.done}/${weekly.total})`}
          </strong>
        </p>
      </Tarjeta>

      {error && <p className={s.error} role="alert">No se pudieron cargar las tareas: {error}</p>}
      {loading && <p className={s.mensaje}>Cargando…</p>}
      {!loading && todays.length === 0 && <p className={s.mensaje}>No tienes tareas para hoy.</p>}

      {todays.map((t) => {
        const st = taskState(t, now);
        const done = st === "done";
        return (
          <div key={t.id} className={unirClases(s.tarea, st === "overdue" && s.tareaVencida)}>
            <button
              type="button"
              aria-label={done ? "Desmarcar" : "Marcar como hecha"}
              disabled={busyId === t.id}
              onClick={() => toggle(t.id, done)}
              className={unirClases(s.marca, done && s.marcaHecha)}
            >
              {done ? "✓" : ""}
            </button>
            <div className={s.tareaTextos}>
              <div className={unirClases(s.tareaTitulo, done && s.tareaTituloHecha)}>{t.title}</div>
              <div className={unirClases(s.tareaHora, st === "overdue" && s.tareaHoraVencida)}>
                {t.time}{st === "overdue" ? " · sin marcar" : ""}
              </div>
            </div>
            <button type="button" aria-label="Eliminar" onClick={() => remove(t.id, t.seriesId, t.dueDate)} className={s.eliminar}>
              <span aria-hidden="true">🗑</span>
            </button>
          </div>
        );
      })}

      {showForm ? (
        <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <Boton variante="agregar" bloque onClick={() => setShowForm(true)}>+ Agregar tarea</Boton>
      )}
    </div>
  );
}
