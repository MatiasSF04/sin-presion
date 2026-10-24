import { addDoc, collection, onSnapshot, query, serverTimestamp, where, type Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { DestinoSos, EventoSos } from "./sos.logic";

/** Cada uso del botón de emergencia queda registrado (trazabilidad): nadie lo edita ni lo borra. */
const COL_SOS = "sosEvents";

/**
 * Registra el uso del botón. Quien llama no espera la escritura antes de abrir la llamada:
 * en una emergencia la llamada va primero y el registro se completa en segundo plano.
 */
export async function registrarSos(elderUid: string, destino: DestinoSos): Promise<void> {
  if (!elderUid) throw new Error("elderUid requerido para registrar el SOS");
  await addDoc(collection(db, COL_SOS), {
    elderUid,
    telefono: destino.telefono,
    nombreContacto: destino.nombre,
    esContacto: destino.esContacto,
    creadoEn: serverTimestamp(),
  });
}

/**
 * Escucha en vivo los usos del botón de un adulto mayor. Sin orderBy para no requerir un índice
 * compuesto: son pocos eventos y se ordenan en el cliente (sosReciente).
 */
export function escucharSos(
  elderUid: string,
  onEventos: (eventos: EventoSos[]) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    query(collection(db, COL_SOS), where("elderUid", "==", elderUid)),
    (snap) =>
      onEventos(
        snap.docs.map((d) => {
          // "estimate": el evento recién creado trae la hora local mientras el servidor confirma
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            elderUid: x.elderUid as string,
            telefono: x.telefono as string,
            nombreContacto: (x.nombreContacto as string) ?? "",
            esContacto: x.esContacto === true,
            creadoEn: (x.creadoEn as Timestamp).toDate(),
          };
        })
      ),
    onError
  );
}
