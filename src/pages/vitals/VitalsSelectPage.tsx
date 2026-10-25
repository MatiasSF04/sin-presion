import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VITAL_TYPES_MANUALES } from "../../services/vitals.service";
import { VitalCard } from "../../components/vitals/VitalCard";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Boton } from "../../components/base/Boton";
import { useAuth } from "../../context/useAuth";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { pedirPermisosReloj, permisosReloj, relojDisponible, sincronizarReloj } from "../../services/reloj.service";
import { registrarError } from "../../services/errores.service";
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
  const [conReloj, setConReloj] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // el botón del reloj aparece solo en Android con Health Connect
  useEffect(() => {
    let activo = true;
    relojDisponible().then((ok) => activo && setConReloj(ok));
    return () => {
      activo = false;
    };
  }, []);

  async function sincronizar() {
    if (!appUser) return;
    setSincronizando(true);
    setMensaje(null);
    try {
      let permisos = await permisosReloj();
      if (permisos.length === 0) permisos = await pedirPermisosReloj();
      if (permisos.length === 0) {
        setMensaje("Para traer los datos de tu reloj, permite el acceso en Health Connect.");
        return;
      }
      const n = await sincronizarReloj(appUser.uid, perfil.metas);
      setMensaje(
        n === 0 ? "Tu reloj ya estaba al día." : `Se trajeron ${n} ${n === 1 ? "medición" : "mediciones"} de tu reloj.`
      );
    } catch (e) {
      registrarError("reloj.sincronizar", e);
      setMensaje("No se pudo leer tu reloj. Intenta de nuevo.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Registrar medición" subtitulo="¿Qué deseas registrar hoy?" volverA="/home" />

      {conReloj && (
        <section className={s.reloj} aria-label="Datos del reloj">
          <Boton variante="secundario" bloque onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? "Trayendo datos…" : "⌚ Sincronizar con mi reloj"}
          </Boton>
          <p className={s.relojAyuda}>Trae tu pulso, pasos y sueño desde la app de tu reloj.</p>
          {mensaje && (
            <p className={s.relojMensaje} role="status">
              {mensaje}
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
