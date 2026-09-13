import { useNavigate } from "react-router-dom";
import { VITAL_TYPES } from "../../services/vitals.service";
import { VitalCard } from "../../components/vitals/VitalCard";
import { colors } from "../../styles/theme";

export function VitalsSelectPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <button style={styles.backButton} onClick={() => navigate("/home")}>
        ←
      </button>
      <h1 style={styles.title}>Registrar medición</h1>
      <p style={styles.subtitle}>¿Qué deseas registrar hoy?</p>

      <div style={styles.grid}>
        {VITAL_TYPES.map((vital) => (
          <VitalCard
            key={vital.type}
            icon={vital.icon}
            label={vital.label}
            color={vital.color}
            colorLight={vital.colorLight}
            onClick={() => navigate(`/vitals/${vital.type}`)}
          />
        ))}
        {/* "Otros" queda pendiente de definir qué campos registra */}
        <button style={styles.othersCard} disabled>
          <span style={styles.othersIcon}>+</span>
          <span style={styles.othersLabel}>Otros</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    padding: "20px",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    fontSize: 18,
    cursor: "pointer",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.textPrimary,
    margin: "0 0 4px",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    margin: "0 0 20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  othersCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "20px 12px",
    borderRadius: 16,
    border: `2px dashed ${colors.border}`,
    backgroundColor: colors.surfaceMuted,
    minHeight: 110,
    cursor: "not-allowed",
    opacity: 0.6,
  },
  othersIcon: {
    fontSize: 28,
    color: colors.textSecondary,
  },
  othersLabel: {
    fontWeight: 700,
    fontSize: 14,
    color: colors.textSecondary,
  },
};