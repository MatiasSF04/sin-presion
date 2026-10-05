import { useState } from "react";
import { Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../../services/firebase";

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
    } catch (err) {
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
    <div style={styles.container}>
      <div style={styles.avatarCircle}>
        <span style={styles.avatarIcon}>👤</span>
      </div>

      <h1 style={styles.title}>SIN-PRESIÓN</h1>
      <p style={styles.subtitle}>Inicia sesión con tu cuenta</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoComplete="current-password"
        />

        {error && <p style={styles.errorText}>{error}</p>}

        {needsVerification && (
          <div style={styles.verificationBox}>
            <p style={styles.errorText}>
              Debes verificar tu correo antes de continuar.
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              style={styles.linkButton}
            >
              Reenviar correo de verificación
            </button>
          </div>
        )}

        <button type="submit" disabled={loading} style={styles.primaryButton}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <p style={styles.footerText}>
        ¿No tienes cuenta?{" "}
        <Link to="/register" style={styles.link}>
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#5B6EF5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  avatarIcon: {
    fontSize: 40,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
  },
  form: {
    width: "100%",
    maxWidth: 340,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    fontSize: 18,
    borderRadius: 14,
    border: "none",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: "16px",
    fontSize: 18,
    fontWeight: 700,
    borderRadius: 14,
    border: "none",
    backgroundColor: "#E53946",
    color: "#FFFFFF",
    cursor: "pointer",
    marginTop: 8,
  },
  errorText: {
    color: "#FFE3E3",
    fontSize: 14,
    textAlign: "center",
    margin: 0,
  },
  verificationBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#FFFFFF",
    textDecoration: "underline",
    fontSize: 14,
    cursor: "pointer",
  },
  footerText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    marginTop: 32,
  },
  link: {
    color: "#FFFFFF",
    fontWeight: 700,
    textDecoration: "underline",
  },
};