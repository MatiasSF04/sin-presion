import { useState } from "react";
import { Link } from "react-router-dom";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { registerWithEmail, type UserRole } from "../../services/auth.service";

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
      <div style={styles.container}>
        <div style={styles.avatarCircle}>
          <span style={styles.avatarIcon}>✉️</span>
        </div>
        <h1 style={styles.title}>Revisa tu correo</h1>
        <p style={styles.subtitle}>
          Enviamos un enlace de verificación a {email}. Después de verificarlo, inicia sesión.
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <Link to="/login" style={styles.primaryLink}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.avatarCircle}>
        <span style={styles.avatarIcon}>👤</span>
      </div>

      <h1 style={styles.title}>Crear cuenta</h1>
      <p style={styles.subtitle}>Completa tus datos para comenzar</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.roleRow}>
          <button
            type="button"
            onClick={() => setRole("elder")}
            style={{ ...styles.roleButton, ...(role === "elder" ? styles.roleActive : {}) }}
          >
            Adulto mayor
          </button>
          <button
            type="button"
            onClick={() => setRole("caregiver")}
            style={{ ...styles.roleButton, ...(role === "caregiver" ? styles.roleActive : {}) }}
          >
            Cuidador
          </button>
        </div>

        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          autoComplete="name"
        />
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
          placeholder="Contraseña (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Repite la contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={styles.input}
          autoComplete="new-password"
        />

        {error && <p style={styles.errorText}>{error}</p>}

        <button type="submit" disabled={loading} style={styles.primaryButton}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p style={styles.footerText}>
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" style={styles.link}>
          Iniciar sesión
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
  avatarIcon: { fontSize: 40 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: 700, marginBottom: 4, textAlign: "center" },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
    maxWidth: 340,
  },
  form: { width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 16 },
  roleRow: { display: "flex", gap: 8 },
  roleButton: {
    flex: 1,
    padding: "14px 8px",
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,0.6)",
    backgroundColor: "transparent",
    color: "#FFFFFF",
    cursor: "pointer",
  },
  roleActive: { backgroundColor: "#FFFFFF", color: "#5B6EF5", borderColor: "#FFFFFF" },
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
  primaryLink: {
    display: "block",
    width: "100%",
    maxWidth: 340,
    boxSizing: "border-box",
    textAlign: "center",
    padding: "16px",
    fontSize: 18,
    fontWeight: 700,
    borderRadius: 14,
    backgroundColor: "#E53946",
    color: "#FFFFFF",
    textDecoration: "none",
  },
  errorText: { color: "#FFE3E3", fontSize: 14, textAlign: "center", margin: 0 },
  footerText: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 32 },
  link: { color: "#FFFFFF", fontWeight: 700, textDecoration: "underline" },
};
