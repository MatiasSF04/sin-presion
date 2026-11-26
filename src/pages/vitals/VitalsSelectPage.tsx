import { useNavigate } from "react-router-dom";
import { VITAL_TYPES_MANUALES } from "../../services/vitals.service";
import { VitalCard } from "../../components/vitals/VitalCard";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Boton } from "../../components/base/Boton";
import { useAuth } from "../../context/useAuth";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { useSincronizarReloj } from "../../hooks/useSincronizarReloj";
import s from "./VitalsSelectPage.module.css";

/**
 * "Otros" será el diario del adulto mayor (cómo se sintió, qué le pasó, qué le está costando),
 * visible luego para su cuidador. Oculto hasta implementarlo; ver tarjeta en Trello.
 */
const MOSTRAR_OTROS = false;

export function VitalsSelectPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { perfil } = usePerfilAdulto(appUser?.uid);
  // el botón del reloj aparece solo en Android con Health Connect
  const reloj = useSincronizarReloj(appUser?.uid, perfil.metas);

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Registrar medición" subtitulo="¿Qué deseas registrar hoy?" volverA="/home" />

      {reloj.disponible && (
        <section className={s.reloj} aria-label="Datos del reloj">
          <Boton variante="secundario" bloque onClick={reloj.sincronizar} disabled={reloj.sincronizando}>
            {reloj.sincronizando ? "Trayendo datos…" : "⌚ Sincronizar con mi reloj"}
          </Boton>
          <p className={s.relojAyuda}>
            Trae tu pulso, pasos y sueño desde la app de tu reloj, y también presión, azúcar, temperatura e
            hidratación si las registras en otro equipo o app conectada a Health Connect.
          </p>
          {reloj.mensaje && (
            <p className={s.relojMensaje} role="status">
              {reloj.mensaje.titulo}
              {reloj.mensaje.detalle && (
                <>
                  <br />
                  <span className={s.relojDetalle}>{reloj.mensaje.detalle}</span>
                </>
              )}
            </p>
          )}
        </section>
      )}

      <div className={s.grilla}>
        {VITAL_TYPES_MANUALES.map((vital) => (
          <VitalCard
            key={vital.type}
            icon={vital.icon}
            label={vital.label}
            color={vital.color}
            colorLight={vital.colorLight}
            onClick={() => navigate(`/vitals/${vital.type}`)}
          />
        ))}
        {MOSTRAR_OTROS && (
          <button type="button" className={s.otros} disabled>
            <span className={s.otrosIcono} aria-hidden="true">+</span>
            <span className={s.otrosEtiqueta}>Otros</span>
          </button>
        )}
      </div>
    </div>
  );
}
