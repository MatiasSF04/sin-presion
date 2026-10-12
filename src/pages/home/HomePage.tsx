import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { computeDayProgress, toISODate } from "../../services/tasks.logic";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import s from "./HomePage.module.css";

interface HomeCard {
  key: string;
  label: string;
  icon: string;
  /** Referencia a un token de color, p. ej. "var(--color-exito)". */
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
      color: "var(--color-exito)",
      onClick: () => navigate("/tasks"),
    },
    {
      key: "vitals",
      label: "Signos vitales",
      icon: "❤️",
      color: "var(--color-advertencia)",
      onClick: () => navigate("/vitals"),
    },
    {
      key: "calendar",
      label: "Calendario",
      icon: "📅",
      color: "var(--color-info)",
      onClick: () => navigate("/calendar"),
    },
    {
      key: "emergency",
      label: "Emergencia",
      icon: "🚨",
      color: "var(--color-emergencia)",
      onClick: handleEmergency,
    },
    {
      key: "summary",
      label: "Resumen",
      icon: "📊",
      color: "var(--color-acento)",
      onClick: () => navigate("/summary"),
    },
  ];

  return (
    <div className={s.pagina}>
      <header className={s.encabezado}>
        <button
          type="button"
          className={s.circulo}
          onClick={() => navigate("/settings")}
          aria-label="Mi perfil"
        >
          <span aria-hidden="true">👤</span>
        </button>
        <span className={s.fecha}>{now.toLocaleDateString("es-CL")}</span>
        <button
          type="button"
          className={s.circulo}
          onClick={() => navigate("/settings")}
          aria-label="Sincronizar smartwatch"
        >
          <span aria-hidden="true">⌚</span>
        </button>
      </header>

      <main className={s.contenido}>
        <ReminderBanner tasks={todays} now={now} onGo={() => navigate("/tasks")} />

        <BarraProgreso porcentaje={progress.pct} etiqueta="Tareas completadas hoy" />
        <p className={s.progreso}>
          {progress.total === 0
            ? "Sin tareas para hoy"
            : `${progress.done} de ${progress.total} tareas completas`}
        </p>

        <nav className={s.lista}>
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={s.tarjeta}
              style={{ "--color-tarjeta": card.color } as CSSProperties}
            >
              <span className={s.tarjetaIcono} aria-hidden="true">{card.icon}</span>
              <span className={s.tarjetaEtiqueta}>{card.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
