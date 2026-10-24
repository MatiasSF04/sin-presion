import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { useUpcomingTasks } from "../../hooks/useUpcomingTasks";
import { useMedicionesRecientes } from "../../hooks/useMedicionesRecientes";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { BarraProgreso } from "../../components/base/BarraProgreso";
import { unirClases } from "../../estilos/unirClases";
import { VITAL_TYPES } from "../../services/vitals.service";
import {
  computeDayProgress, computeWeeklyAdherence, estaAtrasada, toISODate,
} from "../../services/tasks.logic";
import {
  DIAS_FUERA_DE_RANGO, estadoMedicion, formatearMomento, formatearValor, fueraDeRangoRecientes, ultimasPorSigno,
} from "../../services/resumen.logic";
import s from "./CaregiverHomePage.module.css";

/** Inicio del cuidador: resumen en vivo del cumplimiento y de las mediciones de su adulto mayor. */
export function CaregiverHomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);
  const elderUid = vinculo.tipo === "vinculado" ? vinculo.elderUid : undefined;
  // los recordatorios son del adulto mayor: no deben sonar en el teléfono del cuidador
  const { tasks, loading: cargandoTareas } = useUpcomingTasks(elderUid, { programarRecordatorios: false });
  const { mediciones, cargando: cargandoMediciones, error: errorMediciones } = useMedicionesRecientes(elderUid);
  const { perfil } = usePerfilAdulto(elderUid);
  const [ahora, setAhora] = useState(new Date());

  // refresca atrasadas y "hoy/ayer" cada minuto
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
  const fuera = fueraDeRangoRecientes(mediciones, VITAL_TYPES, perfil.metas, ahora);
  const ultimas = ultimasPorSigno(mediciones, VITAL_TYPES);

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo={`Hola, ${appUser?.name ?? ""}`} subtitulo={nombre ? `Cuidando a ${nombre}` : undefined} />

      {vinculo.tipo === "cargando" && <p className={s.mensaje}>Cargando…</p>}
      {vinculo.tipo === "error" && (
        <p className={s.error} role="alert">No se pudo cargar la información. Revisa tu conexión.</p>
      )}

      {vinculo.tipo === "vinculado" && (
        <>
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
            <Boton bloque className={s.accion} onClick={() => navigate("/caregiver/tasks")}>
              Ver tareas de hoy
            </Boton>
          </Tarjeta>

          {errorMediciones && (
            <p className={s.error} role="alert">No se pudieron cargar las mediciones: {errorMediciones}</p>
          )}

          {/* ---------- mediciones fuera de rango ---------- */}
          <h2 className={s.seccion}>Fuera de rango · últimos {DIAS_FUERA_DE_RANGO} días</h2>
          {cargandoMediciones ? (
            <p className={s.mensaje}>Cargando…</p>
          ) : fuera.length === 0 ? (
            <p className={unirClases(s.aviso, s.avisoBien)}>✓ Ninguna medición fuera de rango</p>
          ) : (
            <ul className={s.lista}>
              {fuera.map(({ medicion, signo, camposFuera }) => (
                <li key={medicion.id} className={unirClases(s.aviso, s.avisoFuera)}>
                  <span className={s.avisoTitulo}>
                    <span aria-hidden="true">{signo?.icon}</span> {signo?.label ?? medicion.type}
                  </span>
                  <span>{signo ? formatearValor(signo, medicion.value, camposFuera) : ""}</span>
                  <span className={s.momento}>{formatearMomento(medicion.recordedAt, ahora)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* ---------- última medición de cada signo ---------- */}
          <h2 className={s.seccion}>Últimas mediciones</h2>
          {!cargandoMediciones && (
            <div className={s.grilla}>
              {ultimas.map(({ signo, medicion }) => {
                const estado = medicion ? estadoMedicion(medicion, signo, perfil.metas) : null;
                const tieneRango = signo.fields.some((f) => f.optimo);
                return (
                  <div key={signo.type} className={unirClases(s.signo, estado?.fuera && s.signoFuera)}>
                    <span className={s.signoNombre}>
                      <span aria-hidden="true">{signo.icon}</span> {signo.label}
                    </span>
                    {medicion ? (
                      <>
                        <span className={s.signoValor}>{formatearValor(signo, medicion.value)}</span>
                        <span className={s.momento}>{formatearMomento(medicion.recordedAt, ahora)}</span>
                        {tieneRango && (
                          <span className={estado?.fuera ? s.etiquetaFuera : s.etiquetaBien}>
                            {estado?.fuera ? "Fuera de rango" : "En rango"}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={s.momento}>Sin registros</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Boton variante="secundario" bloque className={s.botonSiguiente} onClick={() => navigate("/caregiver/perfil")}>
            Perfil y metas
          </Boton>
        </>
      )}
    </div>
  );
}
