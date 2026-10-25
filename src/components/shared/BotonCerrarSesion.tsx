import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import { Boton } from "../base/Boton";
import { Dialogo } from "../base/Dialogo";
import { signOut } from "../../services/auth.service";
import { registrarError } from "../../services/errores.service";
import s from "./BotonCerrarSesion.module.css";

/**
 * "Cerrar sesión" con confirmación. Se usa en Mi perfil (adulto mayor), en el inicio del
 * cuidador y en Vincular. Al confirmar, AuthContext detecta la salida y las rutas llevan al login.
 */
export function BotonCerrarSesion() {
  const { setPinUnlocked, refreshPinStatus } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setCerrando(true);
    setError(null);
    try {
      await signOut();
      refreshPinStatus();
      setPinUnlocked(false);
    } catch (e) {
      registrarError("sesion.cerrar", e);
      setError("No se pudo cerrar la sesión. Revisa tu conexión e intenta de nuevo.");
      setCerrando(false);
      setAbierto(false);
    }
  }

  return (
    <div className={s.contenedor}>
      <Boton variante="secundario" bloque onClick={() => setAbierto(true)}>
        Cerrar sesión
      </Boton>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      <Dialogo
        abierto={abierto}
        titulo="¿Cerrar sesión?"
        descripcion="Tendrás que volver a entrar con tu correo y contraseña."
        onCerrar={() => !cerrando && setAbierto(false)}
      >
        <Boton bloque onClick={confirmar} disabled={cerrando}>
          {cerrando ? "Cerrando…" : "Cerrar sesión"}
        </Boton>
        <Boton variante="secundario" bloque onClick={() => setAbierto(false)} disabled={cerrando}>
          Cancelar
        </Boton>
      </Dialogo>
    </div>
  );
}
