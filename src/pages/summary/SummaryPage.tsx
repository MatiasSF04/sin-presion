import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { estadoMedicion } from "../../services/resumen.logic";
import type { MetasSignos } from "../../services/perfil.logic";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { computeWeeklyAdherence } from "../../services/tasks.logic";
import {
  getRecentVitalReadings,
  type StoredVitalReading,
  VITAL_TYPES,
} from "../../services/vitals.service";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { unirClases } from "../../estilos/unirClases";
import { registrarError } from "../../services/errores.service";
import s from "./SummaryPage.module.css";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function isSameWeek(date: Date, reference: Date): boolean {
  const start = new Date(reference);
  start.setDate(reference.getDate() - weekdayIndex(reference));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora mismo";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD} d`;
}

function formatValue(reading: StoredVitalReading): string {
  const v = reading.value;
  switch (reading.type) {
    case "presion":
      return `${v.sistolica}/${v.diastolica} mmHg`;
    case "temperatura":
      return `${v.valor} °C`;
    case "sueno":
      return `${v.horas} h`;
    case "azucar":
      return `${v.valor} mg/dL`;
    case "pasos":
      return `${v.cantidad} pasos`;
    case "hidratacion":
      return `${v.vasos} vasos`;
    case "diuresis":
      return `Orinó ${v.veces} ${v.veces === 1 ? "vez" : "veces"}`;
    case "deposiciones":
      return `${v.veces} ${v.veces === 1 ? "deposición" : "deposiciones"}`;
    default:
      return "—";
  }
}

type Tono = "exito" | "advertencia";

/**
 * Misma evaluación que al registrar y que ve el cuidador: rango sugerido o meta del perfil.
 * La app no diagnostica, por eso solo dice "En rango" o "Fuera de rango". Sin rango (pasos) no hay insignia.
 */
function statusBadge(reading: StoredVitalReading, metas: MetasSignos): { label: string; tono: Tono } | null {
  const signo = VITAL_TYPES.find((v) => v.type === reading.type);
  if (!signo || !signo.fields.some((f) => f.optimo)) return null;
  return estadoMedicion(reading, signo, metas).fuera
    ? { label: "Fuera de rango", tono: "advertencia" }
    : { label: "En rango", tono: "exito" };
}

const CLASE_TONO: Record<Tono, string> = {
  exito: s.insigniaExito,
  advertencia: s.insigniaAdvertencia,
};

const iconByType: Record<string, string> = {
  presion: "❤️",
  temperatura: "🌡️",
  sueno: "🌙",
  azucar: "💧",
  pasos: "📈",
  hidratacion: "🥤",
  diuresis: "🚻",
  deposiciones: "🧻",
};

const CHART_WIDTH = 300;
const CHART_HEIGHT = 140;

export function SummaryPage() {
  const { appUser } = useAuth();
  const { tasks } = useUpcomingTasks(appUser?.uid);
  const { perfil } = usePerfilAdulto(appUser?.uid);
  const [readings, setReadings] = useState<StoredVitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartTypeIndex, setChartTypeIndex] = useState(0);

  useEffect(() => {
    const elderUid = appUser?.uid;
    if (!elderUid) return;
    getRecentVitalReadings(elderUid, 50)
      .then(setReadings)
      .catch((err) => {
        registrarError("mediciones.cargar", err);
        setError("No se pudieron cargar tus mediciones.");
      })
      .finally(() => setLoading(false));
  }, [appUser]);

  const presionReadings = readings.filter((r) => r.type === "presion");
  const now = new Date();
  const weekReadings = readings.filter((r) => isSameWeek(r.recordedAt, now));
  const adherence = computeWeeklyAdherence(tasks, now);

  const avgSistolica = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.sistolica, 0) / presionReadings.length)
    : null;
  const avgDiastolica = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.diastolica, 0) / presionReadings.length)
    : null;
  const avgPulso = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.pulso, 0) / presionReadings.length)
    : null;

  // --- Gráfico genérico: cicla entre los tipos de VITAL_TYPES ---
  const chartConfig = VITAL_TYPES[chartTypeIndex];
  const chartFields = chartConfig.type === "presion" ? chartConfig.fields.slice(0, 2) : chartConfig.fields;
  const chartReadings = readings.filter((r) => r.type === chartConfig.type);

  const chartByDay: (StoredVitalReading | null)[] = Array(7).fill(null);
  for (const r of chartReadings) {
    if (isSameWeek(r.recordedAt, now)) {
      const idx = weekdayIndex(r.recordedAt);
      if (!chartByDay[idx] || r.recordedAt > chartByDay[idx]!.recordedAt) {
        chartByDay[idx] = r;
      }
    }
  }

  const yMin = Math.min(...chartFields.map((f) => f.min));
  const yMax = Math.max(...chartFields.map((f) => f.max));
  const stepX = CHART_WIDTH / 6;

  function yToPixel(value: number) {
    return CHART_HEIGHT - ((value - yMin) / (yMax - yMin)) * CHART_HEIGHT;
  }

  function fieldColor(idx: number) {
    if (chartConfig.type === "presion") return idx === 0 ? "var(--color-primario)" : "var(--color-exito)";
    return chartConfig.color;
  }

  function buildPath(fieldKey: string): string {
    let path = "";
    let drawing = false;
    chartByDay.forEach((r, i) => {
      if (!r) {
        drawing = false;
        return;
      }
      const x = i * stepX;
      const y = yToPixel(r.value[fieldKey]);
      path += drawing ? ` L ${x} ${y}` : `M ${x} ${y}`;
      drawing = true;
    });
    return path;
  }

  function handlePrevType() {
    setChartTypeIndex((i) => (i - 1 + VITAL_TYPES.length) % VITAL_TYPES.length);
  }
  function handleNextType() {
    setChartTypeIndex((i) => (i + 1) % VITAL_TYPES.length);
  }

  const recentList = readings.slice(0, 5);

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Resumen" subtitulo={`${readings.length} registro(s) guardado(s)`} volverA="/home" />

      {loading && <p className={s.mensaje}>Cargando mediciones...</p>}
      {error && <p className={s.error} role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <div className={s.indicadores}>
            <div className={unirClases(s.indicador, s.indicadorPrimario)}>
              <p className={s.indicadorValor}>{avgSistolica ?? "—"}/{avgDiastolica ?? "—"}</p>
              <p className={s.indicadorUnidad}>mmHg</p>
              <p className={s.indicadorNombre}>Promedio P/A</p>
            </div>
            <div className={unirClases(s.indicador, s.indicadorEmergencia)}>
              <p className={s.indicadorValor}>{avgPulso ?? "—"}</p>
              <p className={s.indicadorUnidad}>ppm</p>
              <p className={s.indicadorNombre}>Pulso medio</p>
            </div>
            <div className={unirClases(s.indicador, s.indicadorExito)}>
              <p className={s.indicadorValor}>{adherence.total === 0 ? "—" : `${adherence.pct}%`}</p>
              <p className={s.indicadorUnidad}>tareas (semana)</p>
              <p className={s.indicadorNombre}>Adherencia</p>
            </div>
            <div className={unirClases(s.indicador, s.indicadorInfo)}>
              <p className={s.indicadorValor}>{weekReadings.length}</p>
              <p className={s.indicadorUnidad}>mediciones</p>
              <p className={s.indicadorNombre}>Esta semana</p>
            </div>
          </div>

          <Tarjeta>
            <div className={s.graficoEncabezado}>
              <button type="button" className={s.flecha} onClick={handlePrevType} aria-label="Tipo anterior">
                ‹
              </button>
              <p className={s.tarjetaTitulo}>{chartConfig.label}</p>
              <button type="button" className={s.flecha} onClick={handleNextType} aria-label="Tipo siguiente">
                ›
              </button>
            </div>

            {chartReadings.length === 0 ? (
              <p className={s.vacio}>Aún no hay mediciones de {chartConfig.label.toLowerCase()} esta semana.</p>
            ) : (
              <>
                <svg width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className={s.grafico}>
                  {chartFields.map((field, idx) => (
                    <path key={field.key} d={buildPath(field.key)} fill="none" style={{ stroke: fieldColor(idx) }} strokeWidth={2} />
                  ))}
                  {chartByDay.map((r, i) =>
                    r ? (
                      <g key={i}>
                        {chartFields.map((field, idx) => (
                          <circle
                            key={field.key}
                            cx={i * stepX}
                            cy={yToPixel(r.value[field.key])}
                            r={3}
                            style={{ fill: fieldColor(idx) }}
                          />
                        ))}
                      </g>
                    ) : null
                  )}
                </svg>
                <div className={s.eje}>
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                {chartFields.length > 1 && (
                  <div className={s.leyenda}>
                    {chartFields.map((field, idx) => (
                      <span key={field.key} className={s.leyendaItem}>
                        <span className={s.leyendaPunto} style={{ background: fieldColor(idx) }} />
                        {field.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </Tarjeta>

          <Tarjeta>
            <p className={s.tarjetaTitulo}>Últimas mediciones</p>
            {recentList.length === 0 ? (
              <p className={s.vacio}>Aún no has registrado ninguna medición.</p>
            ) : (
              recentList.map((r) => {
                const badge = statusBadge(r, perfil.metas);
                return (
                  <div key={r.id} className={s.fila}>
                    <span className={s.filaIcono} aria-hidden="true">{iconByType[r.type] ?? "•"}</span>
                    <div className={s.filaTextos}>
                      <p className={s.filaValor}>{formatValue(r)}</p>
                      <p className={s.filaHora}>{formatRelativeTime(r.recordedAt)}</p>
                    </div>
                    {badge && (
                      <span className={unirClases(s.insignia, CLASE_TONO[badge.tono])}>{badge.label}</span>
                    )}
                  </div>
                );
              })
            )}
          </Tarjeta>
        </>
      )}
    </div>
  );
}
