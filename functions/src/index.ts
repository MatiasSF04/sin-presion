/**
 * Funciones de SIN-PRESIÓN: avisos push al cuidador vinculado.
 *  - avisoSos: al instante, cuando el adulto mayor usa el botón de emergencia.
 *  - avisoFueraDeRango: cuando se guarda una medición fuera de rango (de las últimas 24 h).
 *  - avisoIncumplimiento: cada minuto revisa tareas pendientes y avisa si pasó el margen del perfil.
 * Los avisos llegan a los teléfonos registrados en tokensPush (app Android del cuidador).
 */
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  avisoFueraDeRango, avisoIncumplimiento, avisoSos, CANAL_AVISOS, debeAvisarIncumplimiento, esMedicionReciente,
  margenAviso, momentoEnChile, tramosDeBusqueda, ZONA_HORARIA, type Aviso, type TareaParaAviso,
} from "./avisos.logic";

initializeApp();
// misma región que la base de datos (Santiago); pocas instancias: son menos de 10 usuarios
setGlobalOptions({ region: "southamerica-west1", maxInstances: 2 });
const db = getFirestore();

/** Errores de FCM que indican que el token ya no sirve (app desinstalada o sesión cerrada). */
const TOKEN_INVALIDO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function nombreDe(uid: string): Promise<string> {
  const snap = await db.collection("users").doc(uid).get();
  return (snap.get("name") as string | undefined) ?? "Tu familiar";
}

/** Envía el aviso a todos los cuidadores vinculados al adulto mayor. Devuelve cuántos llegaron. */
async function avisarACuidadores(elderUid: string, aviso: Aviso): Promise<number> {
  const vinculos = await db.collection("vinculos").where("elderUid", "==", elderUid).get();
  const cuidadores = [...new Set(vinculos.docs.map((d) => d.get("cuidadorUid") as string))].slice(0, 30);
  if (cuidadores.length === 0) return 0;

  const tokensSnap = await db.collection("tokensPush").where("uid", "in", cuidadores).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) {
    logger.info("Sin teléfonos registrados para avisar", { elderUid, cuidadores: cuidadores.length });
    return 0;
  }

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: aviso.titulo, body: aviso.cuerpo },
    data: { ruta: aviso.ruta },
    android: { priority: "high", notification: { channelId: CANAL_AVISOS } },
  });

  const invalidos = res.responses
    .map((r, i) => (!r.success && TOKEN_INVALIDO.has(r.error?.code ?? "") ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  await Promise.all(invalidos.map((t) => db.collection("tokensPush").doc(t).delete()));

  logger.info("Aviso enviado", { elderUid, ruta: aviso.ruta, enviados: res.successCount, fallidos: res.failureCount });
  return res.successCount;
}

export const avisoSosCuidador = onDocumentCreated("sosEvents/{id}", async (event) => {
  const datos = event.data?.data();
  if (!datos?.elderUid) return;
  const nombre = await nombreDe(datos.elderUid);
  await avisarACuidadores(datos.elderUid, avisoSos(nombre, datos));
});

export const avisoFueraDeRangoCuidador = onDocumentCreated("vitalReadings/{id}", async (event) => {
  const datos = event.data?.data();
  if (!datos?.elderUid || datos.fueraDeRango !== true) return;
  const registradaEn = (datos.recordedAt as Timestamp | undefined)?.toDate() ?? new Date();
  if (!esMedicionReciente(registradaEn, new Date())) return;
  const nombre = await nombreDe(datos.elderUid);
  await avisarACuidadores(datos.elderUid, avisoFueraDeRango(nombre, datos.type, datos.value));
});

export const avisoIncumplimientoCuidador = onSchedule(
  { schedule: "every 1 minutes", timeZone: ZONA_HORARIA, maxInstances: 1, retryCount: 0 },
  async () => {
    const ahora = momentoEnChile(new Date());
    const margenes = new Map<string, number>();
    const nombres = new Map<string, string>();

    for (const tramo of tramosDeBusqueda(ahora)) {
      const snap = await db
        .collection("tasks")
        .where("status", "==", "pending")
        .where("dueDate", "==", tramo.fecha)
        .where("time", ">=", tramo.desde)
        .where("time", "<=", tramo.hasta)
        .get();

      for (const doc of snap.docs) {
        const tarea = doc.data() as TareaParaAviso & { elderUid: string; title: string };
        if (!margenes.has(tarea.elderUid)) {
          const perfil = await db.collection("perfilesAdulto").doc(tarea.elderUid).get();
          margenes.set(tarea.elderUid, margenAviso(perfil.get("margenAvisoMin")));
        }
        if (!debeAvisarIncumplimiento(tarea, margenes.get(tarea.elderUid)!, ahora)) continue;

        if (!nombres.has(tarea.elderUid)) nombres.set(tarea.elderUid, await nombreDe(tarea.elderUid));
        try {
          await avisarACuidadores(tarea.elderUid, avisoIncumplimiento(nombres.get(tarea.elderUid)!, tarea.title, tarea.time));
        } catch (e) {
          logger.error("No se pudo enviar el aviso de incumplimiento", { tarea: doc.id, error: String(e) });
          continue; // se reintenta en el próximo minuto
        }
        // se marca para no repetir el aviso (la app no usa este campo)
        await doc.ref.update({ avisoCuidadorEn: FieldValue.serverTimestamp() });
      }
    }
  }
);
