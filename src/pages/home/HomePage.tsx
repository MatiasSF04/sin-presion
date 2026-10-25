import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { ReminderBanner } from "../../components/shared/ReminderBanner";
import { computeDayProgress, toISODate } from "../../services/tasks.logic";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { Dialogo } from "../../components/base/Dialogo";
import { Boton } from "../../components/base/Boton";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { destinoSos, enlaceLlamada } from "../../services/sos.logic";
import { registrarSos } from "../../services/sos.service";
import { permisosReloj, relojDisponible, sincronizarReloj } from "../../services/reloj.service";
import { registrarError } from "../../services/errores.service";
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
  // contacto de emergencia que guardó su cuidador; sin contacto, el 131
  const { perfil } = usePerfilAdulto(appUser?.uid);
  const destino = destinoSos(perfil.contactoEmergencia);
  const [confirmandoSos, setConfirmandoSos] = useState(false);

  // datos del reloj: al abrir la app se traen en silencio, solo si ya dio permiso antes
  const metasRef = useRef(perfil.metas);
  useEffect(() => {
    metasRef.current = perfil.metas;
  }, [perfil.metas]);
  const uid = appUser?.uid;
  useEffect(() => {
    if (!uid) return;
    (async () => {
      if (!(await relojDisponible())) return;
      if ((await permisosReloj()).length === 0) return;
      await sincronizarReloj(uid, metasRef.current);
    })().catch((e) => registrarError("reloj.sincronizarAlAbrir", e));
  }, [uid]);

  // refresca el banner y el progreso cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = toISODate(now);
  const todays = tasks.filter((t) => t.dueDate === today);
  const progress = computeDayProgress(tasks, today);

  /** Primero se confirma: evita llamadas por un toque accidental. */
  function handleEmergency() {
    setConfirmandoSos(true);
  }

  function llamar() {
    setConfirmandoSos(false);
    // la llamada va primero; el registro (trazabilidad) se completa en segundo plano
    if (appUser) {
      registrarSos(appUser.uid, destino).catch((e) => registrarError("sos.registrar", e));
    }
    window.location.href = enlaceLlamada(destino.telefono);
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

      <Dialogo
        abierto={confirmandoSos}
        titulo={destino.esContacto ? `¿Llamar a ${destino.nombre}?` : "¿Llamar al SAMU (131)?"}
        descripcion={
          destino.esContacto
            ? `Se llamará al ${destino.telefono}.`
            : "Tu cuidador aún no guardó un contacto de emergencia."
        }
        onCerrar={() => setConfirmandoSos(false)}
      >
        <Boton variante="emergencia" bloque onClick={llamar}>
          📞 Llamar
        </Boton>
        <Boton variante="secundario" bloque onClick={() => setConfirmandoSos(false)}>
          Cancelar
        </Boton>
      </Dialogo>
    </div>
  );
}
