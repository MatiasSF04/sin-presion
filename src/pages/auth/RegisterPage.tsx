import { useState } from "react";
import { Link } from "react-router-dom";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { registerWithEmail, type UserRole } from "../../services/auth.service";
import { Boton } from "../../components/base/Boton";
import { unirClases } from "../../estilos/unirClases";
import s from "./Acceso.module.css";

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo.";
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    default:
      return "No pudimos crear la cuenta. Intenta de nuevo.";
  }
}

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<UserRole>("elder");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Completa nombre, correo y contraseña.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(email.trim(), password, name.trim(), role);
      // La cuenta queda sin verificar: se cierra la sesión y se pide verificar el correo.
      await firebaseSignOut(auth);
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={s.pantalla}>
        <div className={s.avatar} aria-hidden="true">✉️</div>
        <h1 className={s.titulo}>Revisa tu correo</h1>
        <p className={s.subtitulo}>
          Enviamos un enlace de verificación a {email}. Después de verificarlo, inicia sesión.
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <Link to="/login" className={s.enlaceBoton}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className={s.pantalla}>
      <div className={s.avatar} aria-hidden="true">👤</div>

      <h1 className={s.titulo}>Crear cuenta</h1>
      <p className={s.subtitulo}>Completa tus datos para comenzar</p>

      <form onSubmit={handleSubmit} className={s.formulario}>
        <div className={s.roles} role="group" aria-label="Tipo de cuenta">
          <button
            type="button"
            aria-pressed={role === "elder"}
            onClick={() => setRole("elder")}
            className={unirClases(s.rol, role === "elder" && s.rolActivo)}
          >
            Adulto mayor
          </button>
          <button
            type="button"
            aria-pressed={role === "caregiver"}
            onClick={() => setRole("caregiver")}
            className={unirClases(s.rol, role === "caregiver" && s.rolActivo)}
          >
            Cuidador
          </button>
        </div>

        <input
          type="text"
          placeholder="Nombre"
          aria-label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={s.campo}
          autoComplete="name"
        />
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
          placeholder="Contraseña (mínimo 6 caracteres)"
          aria-label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={s.campo}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Repite la contraseña"
          aria-label="Repite la contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={s.campo}
          autoComplete="new-password"
        />

        {error && <p className={s.error} role="alert">{error}</p>}

        <Boton type="submit" variante="emergencia" bloque disabled={loading} className={s.botonPrincipal}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Boton>
      </form>

      <p className={s.pie}>
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className={s.enlace}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
