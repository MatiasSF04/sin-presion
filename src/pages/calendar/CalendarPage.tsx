import { useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../../context/AuthContext";
import { colors, radius } from "../../styles/theme";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { addDays, parseISODate, startOfWeek, taskState, toISODate } from "../../services/tasks.logic";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarPage() {
  const { appUser } = useAuth();
  const { tasks, loading, error } = useUpcomingTasks(appUser?.uid);
  const now = new Date();
  const today = toISODate(now);
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState(startOfWeek(today));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof tasks>();
    tasks.forEach((t) => m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t]));
    return m;
  }, [tasks]);

  const selectedTasks = byDay.get(selected) ?? [];
  const label = parseISODate(weekStart).toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Calendario</h1>

      <div style={s.nav}>
        <button style={s.navBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <strong style={{ textTransform: "capitalize" }}>{label}</strong>
        <button style={s.navBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
      </div>

      <div style={s.week}>
        {days.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const pending = list.filter((t) => t.status === "pending").length;
          const overdue = list.some((t) => taskState(t, now) === "overdue");
          const active = d === selected;
          return (
            <button key={d} onClick={() => setSelected(d)} style={{
              ...s.day,
              background: active ? colors.primary : colors.background,
              color: active ? "#fff" : colors.textPrimary,
              borderColor: d === today ? colors.primary : colors.border,
            }}>
              <span style={{ fontSize: 12 }}>{WEEKDAYS[i]}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{parseISODate(d).getDate()}</span>
              <span style={{ fontSize: 11, height: 14, color: active ? "#fff" : overdue ? colors.emergency : colors.textSecondary }}>
                {pending > 0 ? `${pending} pend.` : list.length > 0 ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <h2 style={s.h2}>
        {parseISODate(selected).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      {error && <p style={{ color: colors.emergency }}>No se pudo cargar: {error}</p>}
      {loading && <p style={{ color: colors.textSecondary }}>Cargando…</p>}
      {!loading && selectedTasks.length === 0 && <p style={{ color: colors.textSecondary }}>Sin tareas este día.</p>}
      {selectedTasks.map((t) => {
        const st = taskState(t, now);
        const tag = st === "done" ? ["Hecha", colors.success, colors.successLight]
          : st === "overdue" ? ["Sin marcar", colors.emergency, colors.emergencyLight]
          : ["Pendiente", colors.warning, colors.warningLight];
        return (
          <div key={t.id} style={s.item}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>
                {t.time}{t.remindBeforeMin > 0 ? ` · aviso ${t.remindBeforeMin} min antes` : ""}
              </div>
            </div>
            <span style={{ ...s.tag, color: tag[1], background: tag[2] }}>{tag[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: 20, maxWidth: 520, margin: "0 auto", paddingBottom: 100 },
  h1: { fontSize: 26, margin: "0 0 16px", color: colors.textPrimary },
  h2: { fontSize: 18, margin: "20px 0 10px", textTransform: "capitalize", color: colors.textPrimary },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  navBtn: { width: 40, height: 40, borderRadius: 20, border: `1.5px solid ${colors.border}`, background: colors.background, fontSize: 20, cursor: "pointer" },
  week: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 },
  day: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0", borderRadius: radius.chip, border: "1.5px solid", cursor: "pointer" },
  item: { display: "flex", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, border: `1.5px solid ${colors.border}`, borderRadius: radius.card },
  tag: { fontSize: 13, fontWeight: 600, padding: "4px 10px", borderRadius: 10 },
};
