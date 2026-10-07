import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVitalTypeConfig, addVitalReading } from "../../services/vitals.service";
import { useAuth } from "../../context/AuthContext";
import { colors, radius } from "../../styles/theme";

export function VitalsEntryPage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const { appUser } = useAuth();
  const config = getVitalTypeConfig(type ?? "");

  const [values, setValues] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        config?.fields.map((f) => [f.key, f.default]) ?? []
      ) as Record<string, number>
  );
  const [saving, setSaving] = useState(false);

  if (!config) {
    return (
      <div style={styles.page}>
        <p>Tipo de medición no reconocido.</p>
        <button onClick={() => navigate("/vitals")}>Volver</button>
      </div>
    );
  }

  function adjust(fieldKey: string, delta: number) {
    const field = config!.fields.find((f) => f.key === fieldKey)!;
    setValues((prev) => {
      const next = Math.round((prev[fieldKey] + delta) * 100) / 100;
      return { ...prev, [fieldKey]: Math.min(field.max, Math.max(field.min, next)) };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const elderUid = appUser?.uid;
      if (!elderUid) return;
      await addVitalReading(elderUid, config!.type, values, "manual");
      navigate("/home");
    } catch (err) {
      console.error("Error guardando medición:", err);
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate("/vitals")}>
          ←
        </button>
        <span style={{ ...styles.headerIcon, backgroundColor: config.colorLight }}>
          {config.icon}
        </span>
        <div>
          <h1 style={styles.title}>{config.label}</h1>
          <p style={styles.subtitle}>Ingresa tu medición</p>
        </div>
      </div>

      {config.fields.map((field) => (
        <div key={field.key} style={styles.fieldBlock}>
          <p style={styles.fieldLabel}>{field.label}</p>
          <div style={styles.stepperRow}>
            <button
              style={styles.stepperButton}
              onClick={() => adjust(field.key, -field.step)}
              aria-label={`Disminuir ${field.label}`}
            >
              −
            </button>
            <div style={styles.stepperValue}>
              <span style={styles.valueNumber}>{values[field.key]}</span>
              <span style={styles.valueUnit}>{field.unit}</span>
            </div>
            <button
              style={styles.stepperButton}
              onClick={() => adjust(field.key, field.step)}
              aria-label={`Aumentar ${field.label}`}
            >
              +
            </button>
          </div>
        </div>
      ))}

      {config.normalRangeNote && (
        <div style={styles.noteBox}>
          <p style={styles.noteText}>{config.normalRangeNote}</p>
        </div>
      )}

      <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "Guardar registro"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    padding: "20px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    fontSize: 18,
    cursor: "pointer",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    margin: 0,
  },
  fieldBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.card,
    padding: "16px",
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textSecondary,
    margin: "0 0 12px",
  },
  stepperRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    fontSize: 22,
    cursor: "pointer",
  },
  stepperValue: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  valueNumber: {
    fontSize: 26,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  valueUnit: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  noteBox: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.card,
    padding: "14px",
    marginBottom: 20,
  },
  noteText: {
    fontSize: 13,
    color: colors.textPrimary,
    margin: 0,
  },
  saveButton: {
    width: "100%",
    padding: "16px",
    fontSize: 16,
    fontWeight: 700,
    borderRadius: radius.button,
    border: "none",
    backgroundColor: colors.emergency,
    color: "#FFFFFF",
    cursor: "pointer",
  },
};