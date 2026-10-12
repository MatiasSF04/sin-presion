import { useState } from "react";
import { Boton } from "../base/Boton";
import { Chip } from "../base/Chip";
import { Tarjeta } from "../base/Tarjeta";
import s from "./TaskForm.module.css";
import {
  generarOcurrencias, toISODate, validateDefinition, HORIZON_DAYS,
  type Momento, type Recurrence, type TaskCategory, type TaskDefinition,
} from "../../services/tasks.logic";
import { CATEGORIAS, OPCIONES_RECORDATORIO } from "./opcionesTarea";

interface Props {
  onSubmit: (def: TaskDefinition) => Promise<void>;
  onCancel: () => void;
}

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type RecKind = Recurrence["kind"];

const REPETICIONES: [RecKind, string][] = [
  ["none", "No se repite"],
  ["daily", "Diaria"],
  ["weekly", "Semanal"],
  ["custom", "Personalizada"],
  ["hours", "Cada N horas"],
];
const ATAJOS_HORAS = [4, 6, 8, 12];

/** "mié 15/10" */
function fechaCorta(m: Momento): string {
  const [y, mes, d] = m.dueDate.split("-").map(Number);
  const dia = new Date(y, mes - 1, d).toLocaleDateString("es-CL", { weekday: "short" });
  return `${dia} ${d}/${mes}`;
}

/** Resumen del tratamiento por horas para que la persona confirme antes de guardar. */
function resumenDosis(def: TaskDefinition): string | null {
  // el nombre no influye en las dosis: el resumen aparece aunque aún no se escriba
  if (def.recurrence.kind !== "hours" || validateDefinition({ ...def, title: def.title || "-" })) return null;
  const dosis = generarOcurrencias(def);
  const ultima = dosis[dosis.length - 1];
  const alTope = generarOcurrencias(def, HORIZON_DAYS + 1).length > dosis.length;
  return (
    `Serán ${dosis.length} dosis, la última el ${fechaCorta(ultima)} a las ${ultima.time}` +
    (alTope ? ` (se programan como máximo ${HORIZON_DAYS} días)` : "") +
    "."
  );
}

export function TaskForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("medicamento");
  const [time, setTime] = useState("08:00");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState("");
  const [recKind, setRecKind] = useState<RecKind>("none");
  const [weekDays, setWeekDays] = useState<number[]>([1]);
  const [everyDays, setEveryDays] = useState(3);
  const [everyHours, setEveryHours] = useState(8);
  const [endTime, setEndTime] = useState("");
  const [remind, setRemind] = useState(15);
  const [notifyMissed, setNotifyMissed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function buildRecurrence(): Recurrence {
    if (recKind === "weekly") return { kind: "weekly", days: weekDays };
    if (recKind === "custom") return { kind: "custom", everyDays };
    if (recKind === "hours") return { kind: "hours", everyHours };
    return { kind: recKind };
  }

  const porHoras = recKind === "hours";
  const def: TaskDefinition = {
    title,
    category,
    time,
    startDate,
    endDate: recKind === "none" || !endDate ? undefined : endDate,
    ...(porHoras ? { endTime: endTime || undefined } : {}),
    recurrence: buildRecurrence(),
    remindBeforeMin: remind,
    notifyMissed,
  };
  const resumen = resumenDosis(def);

  async function handleSubmit() {
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
          <label className={s.etiqueta} htmlFor="tarea-hora">{porHoras ? "Primera dosis" : "Hora"}</label>
          <input id="tarea-hora" className={s.campo} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className={s.etiqueta} htmlFor="tarea-inicio">{recKind === "none" || porHoras ? "Fecha" : "Desde"}</label>
          <input id="tarea-inicio" className={s.campo} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <p className={s.etiqueta}>Repetición</p>
      <div className={s.opciones}>
        {REPETICIONES.map(([k, l]) => (
          <Chip key={k} activo={recKind === k} onClick={() => setRecKind(k)}>
            {l}
          </Chip>
        ))}
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
      {porHoras && (
        <>
          <div className={s.opciones}>
            {ATAJOS_HORAS.map((h) => (
              <Chip key={h} activo={everyHours === h} onClick={() => setEveryHours(h)}>
                {h} h
              </Chip>
            ))}
          </div>
          <div className={s.cadaDias}>
            <span>Cada</span>
            <input
              className={s.campoCorto}
              type="number" min={1} max={24} value={everyHours}
              aria-label="Número de horas"
              onChange={(e) => setEveryHours(Number(e.target.value))}
            />
            <span>horas</span>
          </div>

          <p className={s.etiqueta}>Termina el</p>
          <div className={s.columnas}>
            <div>
              <label className={s.etiqueta} htmlFor="tarea-fin">Fecha</label>
              <input id="tarea-fin" className={s.campo} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className={s.etiqueta} htmlFor="tarea-fin-hora">Hora</label>
              <input id="tarea-fin-hora" className={s.campo} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {resumen && <p className={s.vistaPrevia} aria-live="polite">{resumen}</p>}
        </>
      )}
      {recKind !== "none" && !porHoras && (
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
