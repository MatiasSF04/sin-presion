import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { useMedicionesRecientes } from "../../hooks/useMedicionesRecientes";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { useEventosSos } from "../../hooks/useEventosSos";
import { alTocarAviso, registrarPush } from "../../services/push.service";
import { sosReciente } from "../../services/sos.logic";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { BotonCerrarSesion } from "../../components/shared/BotonCerrarSesion";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { unirClases } from "../../estilos/unirClases";
import { VITAL_TYPES } from "../../services/vitals.service";
import {
  computeDayProgress, computeWeeklyAdherence, estaAtrasada, toISODate,
} from "../../services/tasks.logic";
import { DIAS_FUERA_DE_RANGO, formatearMomento, fueraDeRangoRecientes } from "../../services/resumen.logic";
import s from "./CaregiverHomePage.module.css";

/**
 * Inicio del cuidador: resumen en vivo (tareas de hoy, adherencia y mediciones fuera de rango)
 * y, juntos, los tres accesos: tareas, mediciones y perfil.
 */
export function CaregiverHomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);
  const elderUid = vinculo.tipo === "vinculado" ? vinculo.elderUid : undefined;
  // los recordatorios son del adulto mayor: no deben sonar en el teléfono del cuidador
  const { tasks, loading: cargandoTareas } = useUpcomingTasks(elderUid, { programarRecordatorios: false });
  const { mediciones, cargando: cargandoMediciones, error: errorMediciones } = useMedicionesRecientes(elderUid);
  const { perfil } = usePerfilAdulto(elderUid);
  const eventosSos = useEventosSos(elderUid);
  const [ahora, setAhora] = useState(new Date());

  // avisos push: solo en la APK y cuando ya hay un adulto mayor vinculado
  const uid = appUser?.uid;
  useEffect(() => {
    if (!uid || !elderUid) return;
    registrarPush(uid).catch((e) => console.error("No se pudieron activar los avisos", e));
  }, [uid, elderUid]);

  // al tocar un aviso se abre la pantalla que corresponda
  useEffect(() => alTocarAviso((ruta) => navigate(ruta)), [navigate]);

  // refresca las atrasadas cada minuto
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (vinculo.tipo === "sinVinculo") return <Navigate to="/link" replace />;

  const nombre = vinculo.tipo === "vinculado" ? vinculo.nombre : "";
  const hoy = toISODate(ahora);
  const progreso = computeDayProgress(tasks, hoy);
  const semana = computeWeeklyAdherence(tasks, ahora);
  const atrasadas = tasks.filter((t) => t.dueDate === hoy && estaAtrasada(t, ahora)).length;
  const fuera = fueraDeRangoRecientes(mediciones, VITAL_TYPES, perfil.metas, ahora).length;
  const sos = sosReciente(eventosSos, ahora);

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo={`Hola, ${appUser?.name ?? ""}`} subtitulo={nombre ? `Cuidando a ${nombre}` : undefined} />

      {vinculo.tipo === "cargando" && <p className={s.mensaje}>Cargando…</p>}
      {vinculo.tipo === "error" && (
        <p className={s.error} role="alert">No se pudo cargar la información. Revisa tu conexión.</p>
      )}

      {vinculo.tipo === "vinculado" && (
        <>
          {/* ---------- emergencia en las últimas 24 h: lo primero que se ve ---------- */}
          {sos && (
            <div className={s.sos} role="alert">
              <p className={s.sosTitulo}>🚨 {nombre} usó el botón de emergencia</p>
              <p>
                {formatearMomento(sos.creadoEn, ahora)} · llamó a {sos.esContacto ? sos.nombreContacto : "SAMU (131)"}
                {sos.esContacto && ` (${sos.telefono})`}
              </p>
            </div>
          )}

          {/* ---------- tareas de hoy ---------- */}
          <Tarjeta>
            <h2 className={s.tituloSeccion}>Tareas de hoy</h2>
            {cargandoTareas ? (
              <p className={s.mensaje}>Cargando…</p>
            ) : (
              <>
                <div className={s.filaResumen}>
                  <strong>
                    {progreso.total === 0 ? "Sin tareas para hoy" : `${progreso.done} de ${progreso.total} completadas`}
                  </strong>
                  {progreso.total > 0 && <span>{progreso.pct}%</span>}
                </div>
                {progreso.total > 0 && (
                  <div className={s.barra}>
                    <BarraProgreso porcentaje={progreso.pct} etiqueta={`Tareas de hoy completadas por ${nombre}`} />
                  </div>
                )}
                {atrasadas > 0 && (
                  <p className={s.alerta} role="status">
                    {atrasadas === 1 ? "1 tarea atrasada sin marcar" : `${atrasadas} tareas atrasadas sin marcar`}
                  </p>
                )}
                <p className={s.secundario}>
                  Adherencia de la semana:{" "}
                  <strong className={semana.pct >= 80 ? s.bueno : s.bajo}>
                    {semana.total === 0 ? "sin datos aún" : `${semana.pct}% (${semana.done}/${semana.total})`}
                  </strong>
                </p>
              </>
            )}
          </Tarjeta>

          {/* ---------- mediciones fuera de rango (resumen) ---------- */}
          {errorMediciones && (
            <p className={s.error} role="alert">No se pudieron cargar las mediciones: {errorMediciones}</p>
          )}
          {!cargandoMediciones && !errorMediciones && (
            <p className={unirClases(s.aviso, fuera > 0 ? s.avisoFuera : s.avisoBien)} role="status">
              {fuera === 0
                ? `✓ Ninguna medición fuera de rango en ${DIAS_FUERA_DE_RANGO} días`
                : `${fuera === 1 ? "1 medición" : `${fuera} mediciones`} fuera de rango en ${DIAS_FUERA_DE_RANGO} días`}
            </p>
          )}

          {/* ---------- accesos, juntos ---------- */}
          <nav className={s.accesos} aria-label="Accesos del cuidador">
            <Boton bloque onClick={() => navigate("/caregiver/tasks")}>
              Ver tareas de hoy
            </Boton>
            <Boton bloque onClick={() => navigate("/caregiver/mediciones")}>
              Últimas mediciones
            </Boton>
            <Boton variante="secundario" bloque onClick={() => navigate("/caregiver/perfil")}>
              Perfil y metas
            </Boton>
          </nav>
        </>
      )}

      <BotonCerrarSesion />
    </div>
  );
}
