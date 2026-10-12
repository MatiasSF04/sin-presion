import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { Dialogo } from "../../components/base/Dialogo";
import { AvisoDeshacer } from "../../components/base/AvisoDeshacer";
import { TaskForm } from "../../components/tasks/TaskForm";
import { EditarTareaForm, type AlcanceEdicion } from "../../components/tasks/EditarTareaForm";
import { unirClases } from "../../estilos/unirClases";
import {
  createTaskSeries, quitarTarea, quitarSerieDesde, restaurarTareas, updateTask, updateSeriesFrom, ErrorTarea,
} from "../../services/tasks.service";
import {
  agruparTareasDelDia, computeDayProgress, taskState, tieneOcurrenciasSiguientes, toISODate,
  type CambiosTarea, type CreadoPor, type Task, type TaskDefinition,
} from "../../services/tasks.logic";
import s from "./TareasCuidadorPage.module.css";

interface AvisoQuitar {
  mensaje: string;
  ids: string[];
}

/** Tareas de hoy del adulto mayor vinculado: el cuidador agrega, edita y quita las pendientes. */
export function TareasCuidadorPage() {
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);
  const elderUid = vinculo.tipo === "vinculado" ? vinculo.elderUid : undefined;
  // los recordatorios son del adulto mayor: no deben sonar en el teléfono del cuidador
  const { tasks, loading, error } = useUpcomingTasks(elderUid, { programarRecordatorios: false });

  const [now, setNow] = useState(new Date());
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Task | null>(null);
  const [porQuitar, setPorQuitar] = useState<Task | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [aviso, setAviso] = useState<AvisoQuitar | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (vinculo.tipo === "sinVinculo") return <Navigate to="/link" replace />;

  const today = toISODate(now);
  const { pendientes, completadas } = agruparTareasDelDia(tasks, today);
  const progreso = computeDayProgress(tasks, today);
  const nombre = vinculo.tipo === "vinculado" ? vinculo.nombre : "";
  const yo: CreadoPor | null = appUser ? { uid: appUser.uid, rol: "caregiver" } : null;

  function mostrarError(e: unknown, generico: string) {
    if (!(e instanceof ErrorTarea)) console.error(generico, e);
    setErrorAccion(e instanceof ErrorTarea ? e.message : generico);
  }

  async function crear(def: TaskDefinition) {
    if (!elderUid || !yo) throw new Error("Sesión no iniciada");
    await createTaskSeries(elderUid, def, yo);
    setCreando(false);
  }

  async function guardarEdicion(cambios: CambiosTarea, alcance: AlcanceEdicion) {
    if (!elderUid || !editando) return;
    if (alcance === "siguientes") await updateSeriesFrom(elderUid, editando.seriesId, editando.dueDate, cambios);
    else await updateTask(editando.id, cambios);
    setEditando(null);
  }

  async function quitar(modo: "hoy" | "serie") {
    if (!elderUid || !yo || !porQuitar) return;
    const t = porQuitar;
    setQuitando(true);
    setErrorAccion(null);
    try {
      const ids =
        modo === "hoy"
          ? await quitarTarea(t.id, yo)
          : await quitarSerieDesde(elderUid, t.seriesId, t.dueDate, yo);
      setAviso({
        mensaje: modo === "hoy" ? `Quitaste «${t.title}» de hoy.` : `Quitaste «${t.title}» desde hoy en adelante.`,
        ids,
      });
    } catch (e) {
      mostrarError(e, "No se pudo quitar la tarea. Revisa tu conexión.");
    } finally {
      setPorQuitar(null);
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
      mostrarError(e, "No se pudo deshacer. Revisa tu conexión.");
    }
  }

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Tareas de hoy" subtitulo={nombre} volverA="/caregiver" />

      {vinculo.tipo === "error" && (
        <p className={s.error} role="alert">No se pudo cargar el vínculo. Revisa tu conexión.</p>
      )}
      {error && <p className={s.error} role="alert">No se pudieron cargar las tareas: {error}</p>}
      {errorAccion && <p className={s.error} role="alert">{errorAccion}</p>}

      <Tarjeta variante="suave">
        <div className={s.resumenFila}>
          <strong>{progreso.done} de {progreso.total} completadas</strong>
          <span>{progreso.pct}%</span>
        </div>
        <div className={s.barra}>
          <BarraProgreso porcentaje={progreso.pct} etiqueta="Tareas completadas hoy" />
        </div>
      </Tarjeta>

      {editando ? (
        <EditarTareaForm
          tarea={editando}
          ofrecerSiguientes={tieneOcurrenciasSiguientes(tasks, editando)}
          onGuardar={guardarEdicion}
          onCancelar={() => setEditando(null)}
        />
      ) : creando ? (
        <TaskForm onSubmit={crear} onCancel={() => setCreando(false)} />
      ) : (
        <>
          <h2 className={s.seccion}>Pendientes</h2>
          {(loading || vinculo.tipo === "cargando") && <p className={s.mensaje}>Cargando…</p>}
          {!loading && vinculo.tipo === "vinculado" && pendientes.length === 0 && (
            <p className={s.mensaje}>No quedan tareas pendientes hoy.</p>
          )}

          {pendientes.map((t) => {
            const vencida = taskState(t, now) === "overdue";
            return (
              <div key={t.id} className={unirClases(s.tarea, vencida && s.tareaVencida)}>
                <div className={s.tareaFila}>
                  <span className={s.hora}>{t.time}</span>
                  <div className={s.textos}>
                    <span className={s.titulo}>{t.title}</span>
                    {vencida && <span className={s.estadoVencida}>Atrasada · sin marcar</span>}
                    {t.notes && <span className={s.nota}>{t.notes}</span>}
                  </div>
                </div>
                <div className={s.acciones}>
                  <Boton variante="secundario" onClick={() => setEditando(t)} aria-label={`Editar ${t.title}`}>
                    Editar
                  </Boton>
                  <Boton
                    variante="secundario"
                    className={s.quitar}
                    onClick={() => setPorQuitar(t)}
                    aria-label={`Quitar ${t.title}`}
                  >
                    Quitar
                  </Boton>
                </div>
              </div>
            );
          })}

          <Boton variante="agregar" bloque onClick={() => setCreando(true)} disabled={!elderUid}>
            + Agregar tarea
          </Boton>

          {completadas.length > 0 && (
            <>
              <h2 className={s.seccion}>Completadas ({completadas.length})</h2>
              {completadas.map((t) => (
                <div key={t.id} className={unirClases(s.tarea, s.tareaHecha)}>
                  <div className={s.tareaFila}>
                    <span className={s.hora}>{t.time}</span>
                    <div className={s.textos}>
                      <span className={s.titulo}>{t.title}</span>
                      <span className={s.estadoHecha}>
                        ✓ Completada{t.completedAt ? ` a las ${t.completedAt.toTimeString().slice(0, 5)}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <p className={s.mensaje}>Las tareas completadas quedan en el historial y no se modifican.</p>
            </>
          )}
        </>
      )}

      <Dialogo
        abierto={porQuitar !== null}
        titulo={porQuitar ? `¿Quitar «${porQuitar.title}» de las ${porQuitar.time}?` : ""}
        descripcion={`${nombre || "Tu familiar"} dejará de verla en su app. Podrás deshacerlo durante unos segundos.`}
        onCerrar={() => !quitando && setPorQuitar(null)}
      >
        <Boton variante="emergencia" bloque disabled={quitando} onClick={() => quitar("hoy")}>
          Quitar solo la de hoy
        </Boton>
        {porQuitar && tieneOcurrenciasSiguientes(tasks, porQuitar) && (
          <Boton variante="secundario" bloque disabled={quitando} className={s.quitar} onClick={() => quitar("serie")}>
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
