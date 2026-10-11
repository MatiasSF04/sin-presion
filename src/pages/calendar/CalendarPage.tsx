import { useMemo, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { addDays, parseISODate, startOfWeek, taskState, toISODate } from "../../services/tasks.logic";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { unirClases } from "../../estilos/unirClases";
import s from "./CalendarPage.module.css";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ETIQUETAS_ESTADO = {
  done: { texto: "Hecha", clase: s.etiquetaHecha },
  overdue: { texto: "Sin marcar", clase: s.etiquetaVencida },
  pending: { texto: "Pendiente", clase: s.etiquetaPendiente },
} as const;

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
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Calendario" volverA="/home" />

      <div className={s.navegacion}>
        <button type="button" className={s.flecha} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">‹</button>
        <strong className={s.mes}>{label}</strong>
        <button type="button" className={s.flecha} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente">›</button>
      </div>

      <div className={s.semana}>
        {days.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const pending = list.filter((t) => t.status === "pending").length;
          const overdue = list.some((t) => taskState(t, now) === "overdue");
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(d)}
              className={unirClases(s.dia, d === today && s.diaHoy, active && s.diaActivo)}
            >
              <span className={s.diaNombre}>{WEEKDAYS[i]}</span>
              <span className={s.diaNumero}>{parseISODate(d).getDate()}</span>
              <span className={unirClases(s.diaEstado, overdue && s.diaEstadoVencido)}>
                {pending > 0 ? `${pending} pend.` : list.length > 0 ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className={s.diaSeleccionado}>
        {parseISODate(selected).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      {error && <p className={s.error} role="alert">No se pudo cargar: {error}</p>}
      {loading && <p className={s.mensaje}>Cargando…</p>}
      {!loading && selectedTasks.length === 0 && <p className={s.mensaje}>Sin tareas este día.</p>}
      {selectedTasks.map((t) => {
        const etiqueta = ETIQUETAS_ESTADO[taskState(t, now)];
        return (
          <div key={t.id} className={s.tarea}>
            <div className={s.tareaTextos}>
              <div className={s.tareaTitulo}>{t.title}</div>
              <div className={s.tareaDetalle}>
                {t.time}{t.remindBeforeMin > 0 ? ` · aviso ${t.remindBeforeMin} min antes` : ""}
              </div>
            </div>
            <span className={unirClases(s.etiqueta, etiqueta.clase)}>{etiqueta.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
