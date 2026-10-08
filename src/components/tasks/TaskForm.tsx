import { useState, type CSSProperties } from "react";
import { colors, radius } from "../../styles/theme";
import { toISODate, validateDefinition, type Recurrence, type TaskCategory, type TaskDefinition } from "../../services/tasks.logic";

interface Props {
  onSubmit: (def: TaskDefinition) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "medicamento", label: "💊 Medicamento" },
  { value: "cita", label: "🩺 Cita" },
  { value: "ejercicio", label: "🚶 Ejercicio" },
  { value: "medicion", label: "❤️ Medición" },
  { value: "otro", label: "📝 Otro" },
];
const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const REMIND_OPTIONS = [
  { value: 0, label: "Sin aviso previo" },
  { value: 5, label: "5 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
];

type RecKind = Recurrence["kind"];

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
    <div style={s.card}>
      <h2 style={s.h2}>Nueva tarea</h2>

      <label style={s.label}>¿Qué hay que hacer?</label>
      <input style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Tomar losartán 50 mg" />

      <label style={s.label}>Tipo</label>
      <div style={s.row}>
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" onClick={() => setCategory(c.value)} style={chip(category === c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={s.row2}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Hora</label>
          <input style={s.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>{recKind === "none" ? "Fecha" : "Desde"}</label>
          <input style={s.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <label style={s.label}>Repetición</label>
      <div style={s.row}>
        {([["none", "No se repite"], ["daily", "Diaria"], ["weekly", "Semanal"], ["custom", "Personalizada"]] as [RecKind, string][]).map(
          ([k, l]) => (
            <button key={k} type="button" onClick={() => setRecKind(k)} style={chip(recKind === k)}>
              {l}
            </button>
          )
        )}
      </div>

      {recKind === "weekly" && (
        <div style={{ ...s.row, marginTop: 10 }}>
          {DAYS.map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} style={dayBtn(weekDays.includes(i))}>
              {d}
            </button>
          ))}
        </div>
      )}
      {recKind === "custom" && (
        <div style={{ ...s.row, marginTop: 10, alignItems: "center" }}>
          <span>Cada</span>
          <input
            style={{ ...s.input, width: 70, marginTop: 0 }}
            type="number" min={2} max={30} value={everyDays}
            onChange={(e) => setEveryDays(Number(e.target.value))}
          />
          <span>días</span>
        </div>
      )}
      {recKind !== "none" && (
        <>
          <label style={s.label}>Hasta (opcional, máx. 60 días)</label>
          <input style={s.input} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </>
      )}

      <label style={s.label}>Recordatorio</label>
      <select style={s.input} value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
        {REMIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label style={{ ...s.check }}>
        <input type="checkbox" checked={notifyMissed} onChange={(e) => setNotifyMissed(e.target.checked)} />
        Avisarme al día siguiente si no la marqué
      </label>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.row2}>
        <button type="button" onClick={onCancel} style={s.secondary} disabled={saving}>Cancelar</button>
        <button type="button" onClick={handleSubmit} style={s.primary} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

const chip = (active: boolean): CSSProperties => ({
  padding: "10px 14px", borderRadius: radius.chip, fontSize: 15, cursor: "pointer",
  border: `1.5px solid ${active ? colors.primary : colors.border}`,
  background: active ? colors.primaryLight : colors.background,
  color: active ? colors.primary : colors.textPrimary, fontWeight: active ? 600 : 400,
});
const dayBtn = (active: boolean): CSSProperties => ({
  width: 42, height: 42, borderRadius: 21, fontSize: 15, cursor: "pointer",
  border: `1.5px solid ${active ? colors.primary : colors.border}`,
  background: active ? colors.primary : colors.background,
  color: active ? "#fff" : colors.textPrimary, fontWeight: 600,
});
const s: Record<string, CSSProperties> = {
  card: { background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.card, padding: 20, marginBottom: 16 },
  h2: { margin: "0 0 8px", fontSize: 20, color: colors.textPrimary },
  label: { display: "block", marginTop: 14, fontSize: 14, fontWeight: 600, color: colors.textSecondary },
  input: { width: "100%", boxSizing: "border-box", marginTop: 6, padding: "12px 14px", fontSize: 16, borderRadius: radius.button, border: `1.5px solid ${colors.border}`, background: colors.background },
  row: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 },
  row2: { display: "flex", gap: 12, marginTop: 14 },
  check: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 15, color: colors.textPrimary },
  error: { color: colors.emergency, fontSize: 14, marginTop: 12 },
  primary: { flex: 1, padding: 14, borderRadius: radius.button, border: "none", background: colors.primary, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  secondary: { flex: 1, padding: 14, borderRadius: radius.button, border: `1.5px solid ${colors.border}`, background: colors.background, color: colors.textPrimary, fontSize: 16, cursor: "pointer" },
};
