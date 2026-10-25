import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { registrarError } from "./errores.service";

/**
 * Avisos push al cuidador (incumplimiento, SOS, mediciones fuera de rango).
 * Este servicio solo registra el teléfono y guarda su token; los avisos los envía
 * la función programada de Firebase, que lee los tokens con permisos de administrador.
 */
const COL_TOKENS = "tokensPush";
export const CANAL_AVISOS = "avisos-cuidador";
const CLAVE_TOKEN = "sinpresion_push_token";

/** El push solo existe en la app nativa; en la web el cuidador ve los avisos al abrir la página. */
export const pushDisponible = (): boolean => Capacitor.isNativePlatform();

let uidRegistrado: string | null = null;
let escuchando = false;
let tokenActual: string | null = null;

function recordarToken(token: string | null) {
  tokenActual = token;
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // sin localStorage (pruebas): basta con la variable en memoria
  }
}

function tokenGuardado(): string | null {
  if (tokenActual) return tokenActual;
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

/** Guarda el token de este teléfono. El id del documento es el token, así no se duplica. */
export async function guardarToken(uid: string, token: string, plataforma: string): Promise<void> {
  await setDoc(doc(db, COL_TOKENS, token), { uid, plataforma, actualizadoEn: serverTimestamp() });
  recordarToken(token);
}

/**
 * Pide permiso, crea el canal de avisos y registra el teléfono del cuidador.
 * Devuelve false si no aplica (web) o si el usuario no dio permiso. Es seguro llamarla varias veces.
 */
export async function registrarPush(uid: string): Promise<boolean> {
  if (!pushDisponible() || !uid) return false;
  if (uidRegistrado === uid) return true;

  let permiso = await PushNotifications.checkPermissions();
  if (permiso.receive === "prompt" || permiso.receive === "prompt-with-rationale") {
    permiso = await PushNotifications.requestPermissions();
  }
  if (permiso.receive !== "granted") return false;

  // importancia 5 = alta: suena y aparece arriba de la pantalla
  await PushNotifications.createChannel({
    id: CANAL_AVISOS,
    name: "Avisos del cuidador",
    description: "Tareas no cumplidas, emergencias y mediciones fuera de rango",
    importance: 5,
    visibility: 1,
    vibration: true,
  });

  if (!escuchando) {
    escuchando = true;
    await PushNotifications.addListener("registration", (t) => {
      const u = uidRegistrado;
      if (!u) return;
      guardarToken(u, t.value, Capacitor.getPlatform()).catch((e) => registrarError("push.guardarToken", e));
    });
    await PushNotifications.addListener("registrationError", (e) => registrarError("push.registrar", e));
  }

  uidRegistrado = uid;
  await PushNotifications.register();
  return true;
}

/** Al cerrar sesión: borra el token de este teléfono para que no reciba avisos de esa cuenta. */
export async function quitarTokenPush(): Promise<void> {
  if (!pushDisponible()) return;
  const token = tokenGuardado();
  uidRegistrado = null;
  if (token) {
    await deleteDoc(doc(db, COL_TOKENS, token));
    recordarToken(null);
  }
  await PushNotifications.unregister();
}

/** Al tocar un aviso, abre la pantalla que indique (data.ruta) o el inicio del cuidador. */
export function alTocarAviso(navegar: (ruta: string) => void): () => void {
  if (!pushDisponible()) return () => {};
  let quitar: (() => void) | undefined;
  let cancelado = false;
  void PushNotifications.addListener("pushNotificationActionPerformed", (accion) => {
    const ruta = accion.notification.data?.ruta;
    navegar(typeof ruta === "string" && ruta.startsWith("/") ? ruta : "/caregiver");
  }).then((h) => {
    if (cancelado) void h.remove();
    else quitar = () => void h.remove();
  });
  return () => {
    cancelado = true;
    quitar?.();
  };
}
