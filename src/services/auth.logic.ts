/**
 * Lógica pura del acceso (sin Firebase): tiempo límite de espera y traducción de errores
 * a mensajes para el usuario. Así el login nunca queda pegado en "Ingresando...".
 */

/** Segundos máximos que se espera a Firebase antes de avisar un problema de conexión. */
export const LIMITE_ESPERA_MS = 20_000;

/** La espera superó el tiempo límite (casi siempre: sin internet o conexión muy débil). */
export class ErrorTiempoLimite extends Error {
  constructor() {
    super("La operación tardó demasiado");
    this.name = "ErrorTiempoLimite";
  }
}

/** La cuenta existe en Authentication pero no tiene perfil en la colección users. */
export class ErrorPerfilInexistente extends Error {
  constructor() {
    super("Usuario no encontrado en la base de datos");
    this.name = "ErrorPerfilInexistente";
  }
}

/**
 * Espera la promesa como máximo `ms` milisegundos. No cancela la operación de fondo:
 * solo deja de esperarla para poder avisar al usuario.
 */
export function conTiempoLimite<T>(promesa: Promise<T>, ms: number = LIMITE_ESPERA_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new ErrorTiempoLimite()), ms);
    promesa.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

export const MENSAJES_ACCESO = {
  conexion: "No pudimos conectarnos. Revisa tu internet e intenta de nuevo.",
  credenciales: "Correo o contraseña incorrectos.",
  intentos: "Hiciste muchos intentos. Espera unos minutos y vuelve a intentar.",
  desactivada: "Tu cuenta está desactivada. Contacta al equipo de SIN-PRESIÓN.",
  sinPerfil: "Tu cuenta no está completa. Contacta al equipo de SIN-PRESIÓN.",
  correoEnUso: "Ya existe una cuenta con ese correo.",
  correoInvalido: "El correo no es válido.",
  claveDebil: "La contraseña debe tener al menos 6 caracteres.",
  registroIncierto:
    "No pudimos confirmar la creación de tu cuenta. Revisa tu internet; si ya la creaste, intenta iniciar sesión.",
  loginGenerico: "No pudimos iniciar sesión. Intenta de nuevo.",
  registroGenerico: "No pudimos crear la cuenta. Intenta de nuevo.",
} as const;

function codigoDe(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
}

/** ¿El error se debe a la conexión? (Auth, Firestore o el tiempo límite). */
export function esErrorDeConexion(err: unknown): boolean {
  if (err instanceof ErrorTiempoLimite) return true;
  const codigo = codigoDe(err);
  if (codigo === "auth/network-request-failed" || codigo === "unavailable" || codigo === "deadline-exceeded") return true;
  const mensaje = err instanceof Error ? err.message.toLowerCase() : "";
  return mensaje.includes("offline");
}

/** Traduce cualquier error del login o del registro a un mensaje claro en español. */
export function mensajeErrorAcceso(err: unknown, contexto: "login" | "registro"): string {
  if (err instanceof ErrorPerfilInexistente) return MENSAJES_ACCESO.sinPerfil;
  if (esErrorDeConexion(err)) {
    return contexto === "registro" && err instanceof ErrorTiempoLimite
      ? MENSAJES_ACCESO.registroIncierto
      : MENSAJES_ACCESO.conexion;
  }
  switch (codigoDe(err)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return MENSAJES_ACCESO.credenciales;
    case "auth/invalid-email":
      return contexto === "login" ? MENSAJES_ACCESO.credenciales : MENSAJES_ACCESO.correoInvalido;
    case "auth/too-many-requests":
      return MENSAJES_ACCESO.intentos;
    case "auth/user-disabled":
      return MENSAJES_ACCESO.desactivada;
    case "auth/email-already-in-use":
      return MENSAJES_ACCESO.correoEnUso;
    case "auth/weak-password":
      return MENSAJES_ACCESO.claveDebil;
    default:
      return contexto === "login" ? MENSAJES_ACCESO.loginGenerico : MENSAJES_ACCESO.registroGenerico;
  }
}

/** El navegador ya sabe que no hay red (en ese caso se avisa sin intentar). */
export function sinConexion(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
