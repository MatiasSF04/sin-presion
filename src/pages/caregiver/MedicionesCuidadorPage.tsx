import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { useMedicionesRecientes } from "../../hooks/useMedicionesRecientes";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { unirClases } from "../../estilos/unirClases";
import { VITAL_TYPES, getVitalTypeConfig } from "../../services/vitals.service";
import { describirDetalle } from "../../services/vitals.logic";
import {
  DIAS_FUERA_DE_RANGO, estadoMedicion, formatearMomento, formatearValor, medicionesPorDia, ultimasPorSigno,
} from "../../services/resumen.logic";
import s from "./MedicionesCuidadorPage.module.css";

/** Mediciones del adulto mayor: la última de cada signo y las de la semana, con las fuera de rango destacadas. */
export function MedicionesCuidadorPage() {
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);
  const elderUid = vinculo.tipo === "vinculado" ? vinculo.elderUid : undefined;
  const { mediciones, cargando, error } = useMedicionesRecientes(elderUid);
  const { perfil } = usePerfilAdulto(elderUid);
  const [ahora, setAhora] = useState(new Date());

  // refresca "hoy/ayer" cada minuto
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (vinculo.tipo === "sinVinculo") return <Navigate to="/link" replace />;

  const nombre = vinculo.tipo === "vinculado" ? vinculo.nombre : "";
  const ultimas = ultimasPorSigno(mediciones, VITAL_TYPES);
  const porDia = medicionesPorDia(mediciones, VITAL_TYPES, perfil.metas, ahora);
  const totalSemana = porDia.reduce((n, g) => n + g.mediciones.length, 0);
  const fueraSemana = porDia.reduce((n, g) => n + g.mediciones.filter((m) => m.fuera).length, 0);

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Mediciones" subtitulo={nombre} volverA="/caregiver" />

      {vinculo.tipo === "error" && (
        <p className={s.error} role="alert">No se pudo cargar el vínculo. Revisa tu conexión.</p>
      )}
      {error && <p className={s.error} role="alert">No se pudieron cargar las mediciones: {error}</p>}
      {(vinculo.tipo === "cargando" || cargando) && <p className={s.mensaje}>Cargando…</p>}

      {vinculo.tipo === "vinculado" && !cargando && (
        <>
          <p className={unirClases(s.resumen, fueraSemana > 0 ? s.resumenFuera : s.resumenBien)} role="status">
            {totalSemana === 0
              ? `Sin mediciones en los últimos ${DIAS_FUERA_DE_RANGO} días`
              : `${totalSemana} ${totalSemana === 1 ? "medición" : "mediciones"} en ${DIAS_FUERA_DE_RANGO} días · ` +
                (fueraSemana === 0 ? "todas en rango" : `${fueraSemana} fuera de rango`)}
          </p>

          {/* ---------- la última de cada signo ---------- */}
          <h2 className={s.seccion}>Última de cada signo</h2>
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

          {/* ---------- la semana, día por día ---------- */}
          <h2 className={s.seccion}>Últimos {DIAS_FUERA_DE_RANGO} días</h2>
          {porDia.length === 0 && <p className={s.mensaje}>No hay mediciones en este período.</p>}
          {porDia.map((grupo) => (
            <section key={grupo.dia} aria-label={grupo.dia} className={s.dia}>
              <h3 className={s.diaTitulo}>{grupo.dia}</h3>
              <ul className={s.lista}>
                {grupo.mediciones.map(({ medicion, signo, fuera, camposFuera }) => (
                  <li key={medicion.id} className={unirClases(s.fila, fuera && s.filaFuera)}>
                    <span className={s.hora}>{formatearMomento(medicion.recordedAt, ahora).split(" ").pop()}</span>
                    <span className={s.filaTextos}>
                      <span className={s.filaSigno}>
                        <span aria-hidden="true">{signo?.icon}</span> {signo?.label ?? medicion.type}
                        {medicion.source === "device" && <span title="Desde Health Connect (reloj u otro equipo)"> ⌚</span>}
                      </span>
                      <span>
                        {signo ? formatearValor(signo, medicion.value) : ""}
                        {describirDetalle(getVitalTypeConfig(medicion.type)?.opciones, medicion.detalle) &&
                          ` · ${describirDetalle(getVitalTypeConfig(medicion.type)?.opciones, medicion.detalle)}`}
                      </span>
                      {medicion.observaciones && <span className={s.observacion}>“{medicion.observaciones}”</span>}
                      {fuera && signo && (
                        <span className={s.filaFueraTexto}>Fuera de rango: {formatearValor(signo, medicion.value, camposFuera)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
