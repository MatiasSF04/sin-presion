import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getRecentVitalReadings, type StoredVitalReading } from "../../services/vitals.service";
import { colors, radius } from "../../styles/theme";

// TODO: reemplazar por el % real de cumplimiento del checklist cuando tasks.service.ts esté listo
const MOCK_ADHERENCIA_PCT = 95;

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function weekdayIndex(date: Date): number {
  // getDay(): 0=Domingo..6=Sábado → lo convertimos a 0=Lunes..6=Domingo
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
    default:
      return "—";
  }
}

function statusBadge(reading: StoredVitalReading): { label: string; color: string; bg: string } | null {
  if (reading.type === "presion") {
    const { sistolica, diastolica } = reading.value;
    if (sistolica <= 120 && diastolica <= 80) return { label: "Óptima", color: colors.success, bg: colors.successLight };
    if (sistolica <= 139 && diastolica <= 89) return { label: "Normal", color: colors.info, bg: colors.infoLight };
    return { label: "Alta", color: colors.emergency, bg: colors.emergencyLight };
  }
  if (reading.type === "temperatura") {
    const t = reading.value.valor;
    if (t >= 36 && t <= 37.5) return { label: "Normal", color: colors.success, bg: colors.successLight };
    return { label: t > 37.5 ? "Fiebre" : "Baja", color: colors.emergency, bg: colors.emergencyLight };
  }
  return null;
}

const iconByType: Record<string, string> = {
  presion: "❤️",
  temperatura: "🌡️",
  sueno: "🌙",
  azucar: "💧",
  pasos: "📈",
  hidratacion: "🥤",
};

export function SummaryPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [readings, setReadings] = useState<StoredVitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const elderUid = appUser?.uid ?? "dev-user"; // TODO: quitar el respaldo "dev-user" cuando DEV_SKIP_AUTH sea false
    getRecentVitalReadings(elderUid, 50)
      .then(setReadings)
      .catch((err) => {
        console.error("Error cargando mediciones:", err);
        setError("No se pudieron cargar tus mediciones.");
      })
      .finally(() => setLoading(false));
  }, [appUser]);

  const presionReadings = readings.filter((r) => r.type === "presion");
  const now = new Date();
  const weekReadings = readings.filter((r) => isSameWeek(r.recordedAt, now));

  const avgSistolica = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.sistolica, 0) / presionReadings.length)
    : null;
  const avgDiastolica = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.diastolica, 0) / presionReadings.length)
    : null;
  const avgPulso = presionReadings.length
    ? Math.round(presionReadings.reduce((sum, r) => sum + r.value.pulso, 0) / presionReadings.length)
    : null;

  // Para el gráfico: última lectura de presión por día de esta semana (Lun..Dom)
  const chartByDay: (StoredVitalReading | null)[] = Array(7).fill(null);
  for (const r of presionReadings) {
    if (isSameWeek(r.recordedAt, now)) {
      const idx = weekdayIndex(r.recordedAt);
      if (!chartByDay[idx] || r.recordedAt > chartByDay[idx]!.recordedAt) {
        chartByDay[idx] = r;
      }
    }
  }

  const chartWidth = 300;
  const chartHeight = 140;
  const yMin = 60;
  const yMax = 160;
  const stepX = chartWidth / 6;

  function yToPixel(value: number) {
    return chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;
  }

  function buildPath(field: "sistolica" | "diastolica"): string {
    let path = "";
    let drawing = false;
    chartByDay.forEach((r, i) => {
      if (!r) {
        drawing = false;
        return;
      }
      const x = i * stepX;
      const y = yToPixel(r.value[field]);
      path += drawing ? ` L ${x} ${y}` : `M ${x} ${y}`;
      drawing = true;
    });
    return path;
  }

  const recentList = readings.slice(0, 5);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate("/home")}>
          ←
        </button>
        <div>
          <h1 style={styles.title}>Resumen</h1>
          <p style={styles.subtitle}>{readings.length} registro(s) guardado(s)</p>
        </div>
      </div>

      {loading && <p style={styles.loadingText}>Cargando mediciones...</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={styles.tileGrid}>
            <div style={{ ...styles.tile, backgroundColor: colors.primary }}>
              <p style={styles.tileValue}>{avgSistolica ?? "—"}/{avgDiastolica ?? "—"}</p>
              <p style={styles.tileLabel}>mmHg</p>
              <p style={styles.tileCaption}>Promedio P/A</p>
            </div>
            <div style={{ ...styles.tile, backgroundColor: colors.emergency }}>
              <p style={styles.tileValue}>{avgPulso ?? "—"}</p>
              <p style={styles.tileLabel}>ppm</p>
              <p style={styles.tileCaption}>Pulso medio</p>
            </div>
            <div style={{ ...styles.tile, backgroundColor: colors.success }}>
              <p style={styles.tileValue}>{MOCK_ADHERENCIA_PCT}%</p>
              <p style={styles.tileLabel}>medicación</p>
              <p style={styles.tileCaption}>Adherencia</p>
            </div>
            <div style={{ ...styles.tile, backgroundColor: colors.info }}>
              <p style={styles.tileValue}>{weekReadings.length}</p>
              <p style={styles.tileLabel}>mediciones</p>
              <p style={styles.tileCaption}>Esta semana</p>
            </div>
          </div>

          <div style={styles.card}>
            <p style={styles.cardTitle}>Presión arterial</p>
            {presionReadings.length === 0 ? (
              <p style={styles.emptyText}>Aún no hay mediciones de presión esta semana.</p>
            ) : (
              <>
                <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={styles.chart}>
                  <path d={buildPath("sistolica")} fill="none" stroke={colors.primary} strokeWidth={2} />
                  <path d={buildPath("diastolica")} fill="none" stroke={colors.success} strokeWidth={2} />
                  {chartByDay.map((r, i) =>
                    r ? (
                      <g key={i}>
                        <circle cx={i * stepX} cy={yToPixel(r.value.sistolica)} r={3} fill={colors.primary} />
                        <circle cx={i * stepX} cy={yToPixel(r.value.diastolica)} r={3} fill={colors.success} />
                      </g>
                    ) : null
                  )}
                </svg>
                <div style={styles.axisRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label} style={styles.axisLabel}>{label}</span>
                  ))}
                </div>
                <div style={styles.legendRow}>
                  <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: colors.primary }} /> Sistólica</span>
                  <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: colors.success }} /> Diastólica</span>
                </div>
              </>
            )}
          </div>

          <div style={styles.card}>
            <p style={styles.cardTitle}>Últimas mediciones</p>
            {recentList.length === 0 ? (
              <p style={styles.emptyText}>Aún no has registrado ninguna medición.</p>
            ) : (
              recentList.map((r) => {
                const badge = statusBadge(r);
                return (
                  <div key={r.id} style={styles.listRow}>
                    <span style={styles.listIcon}>{iconByType[r.type] ?? "•"}</span>
                    <div style={styles.listInfo}>
                      <p style={styles.listValue}>{formatValue(r)}</p>
                      <p style={styles.listTime}>{formatRelativeTime(r.recordedAt)}</p>
                    </div>
                    {badge && (
                      <span style={{ ...styles.badge, color: badge.color, backgroundColor: badge.bg }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", backgroundColor: colors.background, padding: "20px" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  backButton: {
    width: 40, height: 40, borderRadius: "50%", border: `1px solid ${colors.border}`,
    backgroundColor: colors.background, fontSize: 18, cursor: "pointer",
  },
  title: { fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  subtitle: { fontSize: 13, color: colors.textSecondary, margin: 0 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  errorText: { color: colors.emergency, fontSize: 14 },
  tileGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 },
  tile: { borderRadius: radius.card, padding: "16px", color: "#FFFFFF" },
  tileValue: { fontSize: 22, fontWeight: 700, margin: 0 },
  tileLabel: { fontSize: 12, opacity: 0.85, margin: "2px 0 8px" },
  tileCaption: { fontSize: 13, fontWeight: 600, margin: 0 },
  card: {
    border: `1px solid ${colors.border}`, borderRadius: radius.card, padding: "16px", marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, margin: "0 0 12px" },
  emptyText: { fontSize: 13, color: colors.textSecondary },
  chart: { display: "block" },
  axisRow: { display: "flex", justifyContent: "space-between", marginTop: 4 },
  axisLabel: { fontSize: 11, color: colors.textSecondary },
  legendRow: { display: "flex", gap: 16, marginTop: 10 },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textSecondary },
  legendDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  listRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
    borderBottom: `1px solid ${colors.border}`,
  },
  listIcon: { fontSize: 20 },
  listInfo: { flex: 1 },
  listValue: { fontSize: 14, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  listTime: { fontSize: 12, color: colors.textSecondary, margin: 0 },
  badge: { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 },
};