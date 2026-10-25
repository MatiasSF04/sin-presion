import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { BotonCerrarSesion } from "../../components/shared/BotonCerrarSesion";
import { ErrorVinculo, generarCodigoVinculo } from "../../services/link.service";
import { estaVencido, formatearCodigo, tiempoRestante } from "../../services/link.logic";
import s from "./SettingsPage.module.css";

interface CodigoActivo {
  codigo: string;
  expiraEn: Date;
}

export function SettingsPage() {
  const { appUser } = useAuth();
  const [codigo, setCodigo] = useState<CodigoActivo | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(new Date());

  // la cuenta regresiva corre solo mientras hay un código en pantalla
  useEffect(() => {
    if (!codigo) return;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [codigo]);

  const vencido = codigo ? estaVencido(codigo.expiraEn, ahora) : false;

  async function generar() {
    if (!appUser) return;
    setGenerando(true);
    setError(null);
    try {
      setCodigo(await generarCodigoVinculo(appUser.uid));
      setAhora(new Date());
    } catch (e) {
      console.error("No se pudo generar el código de vinculación", e);
      setError(e instanceof ErrorVinculo ? e.message : "No se pudo generar el código. Revisa tu conexión.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Mi perfil" volverA="/home" />

      <Tarjeta>
        <h2 className={s.tituloSeccion}>Compartir con mi cuidador</h2>
        <p className={s.texto}>
          Genera un código y díctaselo a tu familiar o cuidador. Con él podrá ver tus mediciones y
          ayudarte con tus tareas.
        </p>

        {codigo && !vencido && (
          <div className={s.codigoCaja} aria-live="polite">
            <span className={s.codigo}>{formatearCodigo(codigo.codigo)}</span>
            <span className={s.vigencia}>Vence en {tiempoRestante(codigo.expiraEn, ahora)}</span>
          </div>
        )}

        {codigo && vencido && (
          <p className={s.aviso} role="status">
            El código venció. Genera uno nuevo.
          </p>
        )}

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        <Boton bloque onClick={generar} disabled={generando || !appUser}>
          {generando ? "Generando…" : codigo ? "Generar otro código" : "Generar código"}
        </Boton>
      </Tarjeta>

      {/* La sincronización del reloj (BLE) se agrega en su propio commit. */}

      <BotonCerrarSesion />
    </div>
  );
}
