import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  esMargenValido, esTelefonoValido, leerPerfil, normalizarTelefono, type PerfilAdulto,
} from "./perfil.logic";

/** Un documento por adulto mayor; su id es el elderUid. Lo edita su cuidador vinculado. */
const COL_PERFILES = "perfilesAdulto";

/** Error con mensaje listo para mostrar al usuario. */
export class ErrorPerfil extends Error {}

/**
 * Escucha en vivo el perfil del adulto mayor. Si el cuidador aún no lo configura,
 * entrega los valores por defecto (margen 15 min, rangos sugeridos, sin contacto).
 */
export function escucharPerfil(
  elderUid: string,
  onPerfil: (perfil: PerfilAdulto) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    doc(db, COL_PERFILES, elderUid),
    (snap) => onPerfil(leerPerfil(snap.exists() ? snap.data() : undefined)),
    onError
  );
}

/**
 * Guarda el perfil completo (reemplaza el documento, así una meta que vuelve a lo
 * sugerido se borra en vez de quedar guardada). Solo lo puede hacer el cuidador vinculado.
 */
export async function guardarPerfil(elderUid: string, cuidadorUid: string, perfil: PerfilAdulto): Promise<void> {
  if (!elderUid || !cuidadorUid) throw new ErrorPerfil("Falta el usuario para guardar el perfil.");
  if (!esMargenValido(perfil.margenAvisoMin)) throw new ErrorPerfil("El margen de aviso no es válido.");
  const contacto = perfil.contactoEmergencia;
  if (contacto && !esTelefonoValido(contacto.telefono)) {
    throw new ErrorPerfil("Revisa el teléfono de emergencia: debe tener entre 8 y 15 dígitos.");
  }
  await setDoc(doc(db, COL_PERFILES, elderUid), {
    margenAvisoMin: perfil.margenAvisoMin,
    metas: perfil.metas,
    contactoEmergencia: contacto
      ? { nombre: contacto.nombre.trim(), telefono: normalizarTelefono(contacto.telefono) }
      : null,
    actualizadoPor: cuidadorUid,
    actualizadoEn: serverTimestamp(),
  });
}
