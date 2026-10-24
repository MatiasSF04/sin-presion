import { useNavigate } from "react-router-dom";
import { VITAL_TYPES } from "../../services/vitals.service";
import { VitalCard } from "../../components/vitals/VitalCard";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import s from "./VitalsSelectPage.module.css";

/**
 * "Otros" será el diario del adulto mayor (cómo se sintió, qué le pasó, qué le está costando),
 * visible luego para su cuidador. Oculto hasta implementarlo; ver tarjeta en Trello.
 */
const MOSTRAR_OTROS = false;

export function VitalsSelectPage() {
  const navigate = useNavigate();

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Registrar medición" subtitulo="¿Qué deseas registrar hoy?" volverA="/home" />

      <div className={s.grilla}>
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
