import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { TaskForm } from "../../components/tasks/TaskForm";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { Dialogo } from "../../components/base/Dialogo";
import { AvisoDeshacer } from "../../components/base/AvisoDeshacer";
import { unirClases } from "../../estilos/unirClases";
import { registrarError } from "../../services/errores.service";
import s from "./TasksPage.module.css";
import {
  createTaskSeries, setTaskDone, quitarTarea, quitarSerieDesde, restaurarTareas, ErrorTarea,
} from "../../services/tasks.service";
import {
  computeDayProgress, computeWeeklyAdherence, esQuitable, formatearHora, taskState, tareasDeManana,
  tieneOcurrenciasSiguientes, toISODate, type Task, type TaskDefinition,
} from "../../services/tasks.logic";

interface AvisoQuitar {
  mensaje: string;
  ids: string[];
}

export function TasksPage() {
  const { appUser } = useAuth();
  const elderUid = appUser?.uid;
  const { tasks, loading, error } = useUpcomingTasks(elderUid);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [porQuitar, setPorQuitar] = useState<Task | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [aviso, setAviso] = useState<AvisoQuitar | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // refresca estados (vencida/pendiente) cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = toISODate(now);
  const todays = tasks.filter((t) => t.dueDate === today);
  const proximas = tareasDeManana(tasks, today);
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

  async function quitar(modo: "hoy" | "serie") {
    if (!elderUid || !porQuitar) return;
    const t = porQuitar;
    const por = { uid: elderUid, rol: "elder" as const };
    setQuitando(true);
    setErrorAccion(null);
    try {
      const ids =
        modo === "hoy"
          ? await quitarTarea(t.id, por)
          : await quitarSerieDesde(elderUid, t.seriesId, t, por);
      setAviso({
        mensaje: modo === "hoy" ? `Quitaste «${t.title}» de hoy.` : `Quitaste «${t.title}» desde hoy en adelante.`,
        ids,
      });
      setPorQuitar(null);
    } catch (e) {
      if (!(e instanceof ErrorTarea)) registrarError("tareas.quitar", e);
      setErrorAccion(e instanceof ErrorTarea ? e.message : "No se pudo quitar la tarea. Revisa tu conexión.");
      setPorQuitar(null);
    } finally {
      setQuitando(false);
    }
  }

  async function deshacer() {
    if (!aviso) return;
    const ids = aviso.ids;
    setAviso(null);
    try {
      await restaurarTareas(ids);
    } catch (e) {
      registrarError("tareas.deshacer", e);
      setErrorAccion("No se pudo deshacer. Revisa tu conexión.");
    }
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
      {errorAccion && <p className={s.error} role="alert">{errorAccion}</p>}
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
                {formatearHora(t.time)}{st === "overdue" ? " · sin marcar" : ""}
              </div>
            </div>
            {esQuitable(t, now) && (
              <button type="button" aria-label={`Quitar ${t.title}`} onClick={() => setPorQuitar(t)} className={s.eliminar}>
                <span aria-hidden="true">🗑</span>
              </button>
            )}
          </div>
        );
      })}

      {!loading && proximas.length > 0 && (
        <section aria-labelledby="titulo-proximas" className={s.proximas}>
          <h2 id="titulo-proximas" className={s.seccion}>Próximas · mañana</h2>
          {proximas.map((t) => (
            <div key={t.id} className={unirClases(s.tarea, s.tareaProxima)}>
              <div className={s.tareaTextos}>
                <div className={s.tareaTitulo}>{t.title}</div>
                <div className={s.tareaHora}>{formatearHora(t.time)}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {showForm ? (
        <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <Boton variante="agregar" bloque onClick={() => setShowForm(true)}>+ Agregar tarea</Boton>
      )}

      <Dialogo
        abierto={porQuitar !== null}
        titulo={porQuitar ? `¿Quitar «${porQuitar.title}» de las ${formatearHora(porQuitar.time)}?` : ""}
        descripcion="Podrás deshacerlo durante unos segundos."
        onCerrar={() => !quitando && setPorQuitar(null)}
      >
        <Boton variante="emergencia" bloque disabled={quitando} onClick={() => quitar("hoy")}>
          Quitar solo la de hoy
        </Boton>
        {porQuitar && tieneOcurrenciasSiguientes(tasks, porQuitar) && (
          <Boton variante="secundario" bloque disabled={quitando} className={s.quitarSerie} onClick={() => quitar("serie")}>
            Quitar hoy y los días siguientes
          </Boton>
        )}
        <Boton variante="secundario" bloque disabled={quitando} onClick={() => setPorQuitar(null)}>
          Cancelar
        </Boton>
      </Dialogo>

      {aviso && <AvisoDeshacer mensaje={aviso.mensaje} onDeshacer={deshacer} onCerrar={() => setAviso(null)} />}
    </div>
  );
}
