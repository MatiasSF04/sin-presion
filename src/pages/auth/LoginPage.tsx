import { useState } from "react";
import { Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../../services/firebase";
import { useAuth } from "../../context/useAuth";
import { conTiempoLimite, mensajeErrorAcceso, MENSAJES_ACCESO, sinConexion } from "../../services/auth.logic";
import { Boton } from "../../components/base/Boton";
import s from "./Acceso.module.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const { errorPerfil, reintentarPerfil, limpiarErrorPerfil } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    limpiarErrorPerfil();

    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    if (sinConexion()) {
      setError(MENSAJES_ACCESO.conexion);
      return;
    }

    setLoading(true);
    try {
      const credential = await conTiempoLimite(signInWithEmailAndPassword(auth, email, password));

      if (!credential.user.emailVerified) {
        setNeedsVerification(true);
        await signOut(auth);
        setLoading(false);
        return;
      }
      // Correo verificado: se espera el perfil para poder avisar si falla (sin conexión o
      // cuenta sin perfil). Si se carga bien, las rutas cambian solas de pantalla.
      const errorAlCargar = await reintentarPerfil();
      if (errorAlCargar) {
        setError(errorAlCargar);
        setLoading(false);
      }
    } catch (err) {
      setError(mensajeErrorAcceso(err, "login"));
      setLoading(false);
    }
  }

  // Sesión guardada pero el perfil no cargó (p. ej. se abrió la app sin internet):
  // se puede reintentar sin volver a escribir correo y contraseña.
  const puedeReintentar = !!errorPerfil && !!auth.currentUser;

  async function reintentar() {
    setError("");
    setLoading(true);
    const errorAlCargar = await reintentarPerfil();
    if (errorAlCargar) setLoading(false);
  }

  async function handleResendVerification() {
    setError("");
    try {
      const credential = await conTiempoLimite(signInWithEmailAndPassword(auth, email, password));
      await conTiempoLimite(sendEmailVerification(credential.user));
      await signOut(auth);
      setError("Te enviamos un nuevo correo de verificación. Revisa tu bandeja.");
    } catch (err) {
      setError(
        mensajeErrorAcceso(err, "login") === MENSAJES_ACCESO.conexion
          ? MENSAJES_ACCESO.conexion
          : "No pudimos reenviar el correo, intenta de nuevo."
      );
    }
  }

  return (
    <div className={s.pantalla}>
      <div className={s.avatar} aria-hidden="true">👤</div>

      <h1 className={s.titulo}>SIN-PRESIÓN</h1>
      <p className={s.subtitulo}>Inicia sesión con tu cuenta</p>

      <form onSubmit={handleSubmit} className={s.formulario}>
        <input
          type="email"
          placeholder="Correo electrónico"
          aria-label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={s.campo}
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Contraseña"
          aria-label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={s.campo}
          autoComplete="current-password"
        />

        {(error || errorPerfil) && <p className={s.error} role="alert">{error || errorPerfil}</p>}

        {puedeReintentar && (
          <Boton variante="secundario" bloque onClick={reintentar} disabled={loading}>
            Reintentar
          </Boton>
        )}

        {needsVerification && (
          <div className={s.verificacion}>
            <p className={s.error}>Debes verificar tu correo antes de continuar.</p>
            <Boton variante="enlace" onClick={handleResendVerification}>
              Reenviar correo de verificación
            </Boton>
          </div>
        )}

        <Boton type="submit" variante="emergencia" bloque disabled={loading} className={s.botonPrincipal}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </Boton>
      </form>

      <p className={s.pie}>
        ¿No tienes cuenta?{" "}
        <Link to="/register" className={s.enlace}>
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
