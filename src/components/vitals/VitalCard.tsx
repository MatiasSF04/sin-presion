import { radius } from "../../styles/theme";

interface VitalCardProps {
  icon: string;
  label: string;
  color: string;
  colorLight: string;
  onClick: () => void;
}

export function VitalCard({ icon, label, color, colorLight, onClick }: VitalCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.card,
        backgroundColor: colorLight,
        borderColor: color,
      }}
    >
      <span style={{ ...styles.iconCircle, backgroundColor: color }}>{icon}</span>
      <span style={styles.label}>{label}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "20px 12px",
    borderRadius: radius.card,
    border: "2px solid",
    cursor: "pointer",
    minHeight: 110,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },
  label: {
    fontWeight: 700,
    fontSize: 14,
    color: "#1F2933",
    textAlign: "center",
  },
};