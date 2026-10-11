import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { computeDayProgress, toISODate } from "../../services/tasks.logic";
import { colors, radius } from "../../styles/theme";

interface HomeCard {
  key: string;
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
}

export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { tasks } = useUpcomingTasks(appUser?.uid);
  const [now, setNow] = useState(new Date());

  // refresca el banner y el progreso cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = toISODate(now);
  const todays = tasks.filter((t) => t.dueDate === today);
  const progress = computeDayProgress(tasks, today);

  function handleEmergency() {
    // TODO: reemplazar el número fijo por el contacto de emergencia guardado en el perfil
    // y registrar el evento en Firestore vía sos.service.ts (colección sosEvents)
    window.location.href = "tel:131";
  }

  const cards: HomeCard[] = [
    {
      key: "tasks",
      label: "Tareas pendientes",
      icon: "📋",
      color: colors.success,
      onClick: () => navigate("/tasks"),
    },
    {
      key: "vitals",
      label: "Signos vitales",
      icon: "❤️",
      color: colors.warning,
      onClick: () => navigate("/vitals"),
    },
    {
      key: "calendar",
      label: "Calendario",
      icon: "📅",
      color: colors.info,
      onClick: () => navigate("/calendar"),
    },
    {
      key: "emergency",
      label: "Emergencia",
      icon: "🚨",
      color: colors.emergency,
      onClick: handleEmergency,
    },
    {
      key: "summary",
      label: "Resumen",
      icon: "📊",
      color: colors.accent,
      onClick: () => navigate("/summary"),
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.avatarCircle}>
          <span style={styles.avatarIcon}>👤</span>
        </div>
        {/* TODO: mostrar la fecha real del día en vez de un valor fijo */}
        <span style={styles.headerDate}>
          {new Date().toLocaleDateString("es-CL")}
        </span>
        <button
          style={styles.syncButton}
          onClick={() => navigate("/settings")}
          aria-label="Sincronizar smartwatch"
        >
          ⌚
        </button>
      </div>

      <div style={styles.content}>
        <ReminderBanner tasks={todays} now={now} onGo={() => navigate("/tasks")} />

        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress.pct}%` }} />
        </div>
        <p style={styles.progressLabel}>
          {progress.total === 0
            ? "SIN TAREAS PARA HOY"
            : `${progress.done}/${progress.total} TAREAS COMPLETAS`}
        </p>

        <div style={styles.list}>
          {cards.map((card) => (
            <button
              key={card.key}
              onClick={card.onClick}
              style={{ ...styles.card, backgroundColor: card.color }}
            >
              <span style={styles.cardIconCircle}>{card.icon}</span>
              <span style={styles.cardLabel}>{card.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    padding: "20px 24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    fontSize: 18,
  },
  headerDate: {
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 15,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "rgba(255,255,255,0.25)",
    fontSize: 18,
    cursor: "pointer",
  },
  content: {
    flex: 1,
    padding: "20px",
    marginTop: -12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 999,
    transition: "width 0.3s ease",
  },
  progressLabel: {
    textAlign: "center",
    fontWeight: 700,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "18px 20px",
    borderRadius: radius.card,
    border: "none",
    cursor: "pointer",
    width: "100%",
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    flexShrink: 0,
  },
  cardLabel: {
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 16,
    textAlign: "left",
  },
};