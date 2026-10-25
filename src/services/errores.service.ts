import { Capacitor } from "@capacitor/core";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Registro de errores del piloto: cada falla inesperada queda en Firestore (registroErrores)
 * para poder darle seguimiento, porque en el teléfono de un participante la consola no se ve.
 * Los documentos se borran solos a los 30 días con una política TTL sobre el campo expiraEn.
 */
const COL_ERRORES = "registroErrores";
export const DIAS_RETENCION_ERRORES = 30;
export const MAX_ERRORES_POR_SESION = 20;
export const LARGO_MAX_MENSAJE = 500;
const LARGO_MAX_CODIGO = 60;
export const VERSION_APP: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "desconocida";

let enviados = 0;
let ultimaClave = "";

/** Extrae un mensaje y un código cortos de cualquier error (Firebase, Error o texto). */
export function describirError(err: unknown): { mensaje: string; codigo: string } {
  const codigo =
    typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  const mensaje = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err) ?? "";
  return {
    mensaje: (mensaje || "(sin mensaje)").slice(0, LARGO_MAX_MENSAJE),
    codigo: codigo.slice(0, LARGO_MAX_CODIGO),
  };
}

/**
 * Registra una falla inesperada. Nunca lanza ni hace esperar a quien la llama: si el registro
 * no se puede guardar (p. ej. sin internet o sin sesión), solo queda en la consola.
 * No repite el mismo error dos veces seguidas y guarda como máximo MAX_ERRORES_POR_SESION.
 * @param funcionalidad dónde ocurrió, p. ej. "mediciones.guardar"
 */
export function registrarError(funcionalidad: string, err: unknown): void {
  console.error(`[${funcionalidad}]`, err);
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return; // las reglas exigen sesión
    const { mensaje, codigo } = describirError(err);
    const clave = `${funcionalidad}|${codigo}|${mensaje}`;
    if (clave === ultimaClave || enviados >= MAX_ERRORES_POR_SESION) return;
    ultimaClave = clave;
    enviados++;
    void addDoc(collection(db, COL_ERRORES), {
      funcionalidad: funcionalidad.slice(0, 60),
      mensaje,
      codigo,
      uid,
      plataforma: Capacitor.getPlatform(),
      versionApp: VERSION_APP,
      creadoEn: serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + DIAS_RETENCION_ERRORES * 24 * 60 * 60 * 1000),
    }).catch(() => {});
  } catch {
    // el registro de errores nunca debe interrumpir la app
  }
}
