import { useState } from "react";
import { Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../../services/firebase";
import { Boton } from "../../components/base/Boton";
import s from "./Acceso.module.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);

    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      if (!credential.user.emailVerified) {
        setNeedsVerification(true);
        await signOut(auth);
        setLoading(false);
        return;
      }
      // Si el correo está verificado, el AuthContext detecta el cambio de sesión
      // automáticamente y las rutas redirigen solas a la pantalla de PIN.
    } catch {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setError("");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      setError("Te enviamos un nuevo correo de verificación. Revisa tu bandeja.");
    } catch {
      setError("No pudimos reenviar el correo, intenta de nuevo.");
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

        {error && <p className={s.error} role="alert">{error}</p>}

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
