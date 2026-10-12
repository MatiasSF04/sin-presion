import { useState } from "react";
import { Boton } from "../base/Boton";
import { Chip } from "../base/Chip";
import { Tarjeta } from "../base/Tarjeta";
import s from "./TaskForm.module.css";
import {
  esTratamientoPorHoras, validarCambios, type CambiosTarea, type Task, type TaskCategory,
} from "../../services/tasks.logic";
import { CATEGORIAS, OPCIONES_RECORDATORIO } from "./opcionesTarea";

export type AlcanceEdicion = "solo" | "siguientes";

interface Props {
  tarea: Task;
  /** Si la serie tiene días pendientes posteriores, se ofrece aplicar el cambio a todos. */
  ofrecerSiguientes: boolean;
  onGuardar: (cambios: CambiosTarea, alcance: AlcanceEdicion) => Promise<void>;
  onCancelar: () => void;
}

/**
 * Edición de una tarea existente. Solo cambia nombre, nota, tipo, hora y recordatorios;
 * para cambiar fecha o repetición se quita la tarea y se crea otra. En los tratamientos
 * por horas la hora tampoco se cambia (el servicio la ignora igual).
 */
export function EditarTareaForm({ tarea, ofrecerSiguientes, onGuardar, onCancelar }: Props) {
  const [title, setTitle] = useState(tarea.title);
  const [notes, setNotes] = useState(tarea.notes ?? "");
  const [category, setCategory] = useState<TaskCategory>(tarea.category);
  const [time, setTime] = useState(tarea.time);
  const [remind, setRemind] = useState(tarea.remindBeforeMin);
  const [notifyMissed, setNotifyMissed] = useState(tarea.notifyMissed);
  const [alcance, setAlcance] = useState<AlcanceEdicion>("solo");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const porHoras = esTratamientoPorHoras(tarea);

  async function guardar() {
    const cambios: CambiosTarea = { title, notes, category, time, remindBeforeMin: remind, notifyMissed };
    const err = validarCambios(cambios);
    if (err) return setError(err);
    setError(null);
    setGuardando(true);
    try {
      await onGuardar(cambios, ofrecerSiguientes ? alcance : "solo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 className={s.titulo}>Editar tarea</h2>

      <label className={s.etiqueta} htmlFor="editar-titulo">¿Qué hay que hacer?</label>
      <input id="editar-titulo" className={s.campo} value={title} onChange={(e) => setTitle(e.target.value)} />

      <p className={s.etiqueta}>Tipo</p>
      <div className={s.opciones}>
        {CATEGORIAS.map((c) => (
          <Chip key={c.value} activo={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <label className={s.etiqueta} htmlFor="editar-hora">
        {porHoras ? `Hora (tratamiento cada ${tarea.frecuenciaHoras} h)` : "Hora"}
      </label>
      <input
        id="editar-hora"
        className={s.campo}
        type="time"
        value={time}
        disabled={porHoras}
        aria-describedby={porHoras ? "editar-hora-aviso" : undefined}
        onChange={(e) => setTime(e.target.value)}
      />
      {porHoras && (
        <p id="editar-hora-aviso" className={s.avisoHora}>
          No es posible modificar las horas de un tratamiento con medicamentos. Para modificar la hora de
          ingesta debe eliminar y volver a crear la tarea.
        </p>
      )}

      <label className={s.etiqueta} htmlFor="editar-nota">Nota (opcional)</label>
      <input
        id="editar-nota"
        className={s.campo}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ej: tomar después del almuerzo"
      />

      <label className={s.etiqueta} htmlFor="editar-aviso">Recordatorio</label>
      <select id="editar-aviso" className={s.campo} value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
        {OPCIONES_RECORDATORIO.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label className={s.casilla}>
        <input type="checkbox" checked={notifyMissed} onChange={(e) => setNotifyMissed(e.target.checked)} />
        Avisar al día siguiente si no se marcó
      </label>

      {ofrecerSiguientes && (
        <>
          <p className={s.etiqueta}>Aplicar el cambio a</p>
          <div className={s.opciones}>
            <Chip activo={alcance === "solo"} onClick={() => setAlcance("solo")}>
              {porHoras ? "Solo esta dosis" : "Solo hoy"}
            </Chip>
            <Chip activo={alcance === "siguientes"} onClick={() => setAlcance("siguientes")}>
              {porHoras ? "Esta y las siguientes dosis" : "Hoy y los días siguientes"}
            </Chip>
          </div>
        </>
      )}

      {error && <p className={s.error} role="alert">{error}</p>}

      <div className={s.columnas}>
        <Boton variante="secundario" onClick={onCancelar} disabled={guardando}>Cancelar</Boton>
        <Boton variante="primario" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </Tarjeta>
  );
}
