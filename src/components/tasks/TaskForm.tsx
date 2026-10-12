import { useState } from "react";
import { Boton } from "../base/Boton";
import { Chip } from "../base/Chip";
import { Tarjeta } from "../base/Tarjeta";
import s from "./TaskForm.module.css";
import { toISODate, validateDefinition, type Recurrence, type TaskCategory, type TaskDefinition } from "../../services/tasks.logic";
import { CATEGORIAS, OPCIONES_RECORDATORIO } from "./opcionesTarea";

interface Props {
  onSubmit: (def: TaskDefinition) => Promise<void>;
  onCancel: () => void;
}

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type RecKind = Exclude<Recurrence["kind"], "hours">; // "cada N horas" llega en 5b

export function TaskForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("medicamento");
  const [time, setTime] = useState("08:00");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState("");
  const [recKind, setRecKind] = useState<RecKind>("none");
  const [weekDays, setWeekDays] = useState<number[]>([1]);
  const [everyDays, setEveryDays] = useState(3);
  const [remind, setRemind] = useState(15);
  const [notifyMissed, setNotifyMissed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function buildRecurrence(): Recurrence {
    if (recKind === "weekly") return { kind: "weekly", days: weekDays };
    if (recKind === "custom") return { kind: "custom", everyDays };
    return { kind: recKind };
  }

  async function handleSubmit() {
    const def: TaskDefinition = {
      title,
      category,
      time,
      startDate,
      endDate: recKind === "none" || !endDate ? undefined : endDate,
      recurrence: buildRecurrence(),
      remindBeforeMin: remind,
      notifyMissed,
    };
    const err = validateDefinition(def);
    if (err) return setError(err);
    setError(null);
    setSaving(true);
    try {
      await onSubmit(def);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  const toggleDay = (d: number) =>
    setWeekDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <Tarjeta>
      <h2 className={s.titulo}>Nueva tarea</h2>

      <label className={s.etiqueta} htmlFor="tarea-titulo">¿Qué hay que hacer?</label>
      <input
        id="tarea-titulo"
        className={s.campo}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ej: Tomar losartán 50 mg"
      />

      <p className={s.etiqueta}>Tipo</p>
      <div className={s.opciones}>
        {CATEGORIAS.map((c) => (
          <Chip key={c.value} activo={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <div className={s.columnas}>
        <div>
          <label className={s.etiqueta} htmlFor="tarea-hora">Hora</label>
          <input id="tarea-hora" className={s.campo} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className={s.etiqueta} htmlFor="tarea-inicio">{recKind === "none" ? "Fecha" : "Desde"}</label>
          <input id="tarea-inicio" className={s.campo} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <p className={s.etiqueta}>Repetición</p>
      <div className={s.opciones}>
        {([["none", "No se repite"], ["daily", "Diaria"], ["weekly", "Semanal"], ["custom", "Personalizada"]] as [RecKind, string][]).map(
          ([k, l]) => (
            <Chip key={k} activo={recKind === k} onClick={() => setRecKind(k)}>
              {l}
            </Chip>
          )
        )}
      </div>

      {recKind === "weekly" && (
        <div className={s.opciones}>
          {DAYS.map((d, i) => (
            <Chip key={i} forma="redondo" activo={weekDays.includes(i)} onClick={() => toggleDay(i)} aria-label={DAY_NAMES[i]}>
              {d}
            </Chip>
          ))}
        </div>
      )}
      {recKind === "custom" && (
        <div className={s.cadaDias}>
          <span>Cada</span>
          <input
            className={s.campoCorto}
            type="number" min={2} max={30} value={everyDays}
            aria-label="Número de días"
            onChange={(e) => setEveryDays(Number(e.target.value))}
          />
          <span>días</span>
        </div>
      )}
      {recKind !== "none" && (
        <>
          <label className={s.etiqueta} htmlFor="tarea-fin">Hasta (opcional, máx. 60 días)</label>
          <input id="tarea-fin" className={s.campo} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </>
      )}

      <label className={s.etiqueta} htmlFor="tarea-aviso">Recordatorio</label>
      <select id="tarea-aviso" className={s.campo} value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
        {OPCIONES_RECORDATORIO.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label className={s.casilla}>
        <input type="checkbox" checked={notifyMissed} onChange={(e) => setNotifyMissed(e.target.checked)} />
        Avisarme al día siguiente si no la marqué
      </label>

      {error && <p className={s.error} role="alert">{error}</p>}

      <div className={s.columnas}>
        <Boton variante="secundario" onClick={onCancel} disabled={saving}>Cancelar</Boton>
        <Boton variante="primario" onClick={handleSubmit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </Tarjeta>
  );
}
