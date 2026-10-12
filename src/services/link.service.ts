import {
  collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  calcularExpiracion, esCodigoValido, estaVencido, generarCodigo, idVinculo, normalizarCodigo,
} from "./link.logic";

const COL_CODIGOS = "codigosVinculo";
const COL_VINCULOS = "vinculos";
const MAX_INTENTOS = 5;

/** Error con mensaje listo para mostrar al usuario. */
export class ErrorVinculo extends Error {}

/**
 * Adulto mayor: genera un código de un solo uso, válido 15 minutos.
 * Si el código ya existe, las reglas tratan la escritura como update y la rechazan
 * (permission-denied); en ese caso se reintenta con otro código.
 */
export async function generarCodigoVinculo(
  elderUid: string
): Promise<{ codigo: string; expiraEn: Date }> {
  if (!elderUid) throw new ErrorVinculo("Falta el usuario para generar el código");

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const codigo = generarCodigo();
    const expiraEn = calcularExpiracion(new Date());
    try {
      await setDoc(doc(db, COL_CODIGOS, codigo), {
        elderUid,
        expiraEn: Timestamp.fromDate(expiraEn),
        creadoEn: Timestamp.now(),
      });
      return { codigo, expiraEn };
    } catch (e) {
      const colision = (e as { code?: string }).code === "permission-denied";
      if (!colision || intento === MAX_INTENTOS) throw e;
    }
  }
  throw new ErrorVinculo("No se pudo generar el código, inténtalo de nuevo");
}

/**
 * Cuidador: canjea el código y crea el vínculo. En el mismo batch borra el código,
 * para que no se pueda usar dos veces. Devuelve el uid del adulto mayor vinculado.
 */
export async function canjearCodigoVinculo(cuidadorUid: string, entrada: string): Promise<string> {
  const codigo = normalizarCodigo(entrada);
  if (!esCodigoValido(codigo)) throw new ErrorVinculo("El código debe tener 6 dígitos");

  const snapCodigo = await getDoc(doc(db, COL_CODIGOS, codigo));
  if (!snapCodigo.exists()) throw new ErrorVinculo("El código no existe o ya fue usado");

  const { elderUid, expiraEn } = snapCodigo.data() as { elderUid: string; expiraEn: Timestamp };
  if (estaVencido(expiraEn.toDate(), new Date())) {
    throw new ErrorVinculo("El código venció. Pídele uno nuevo a tu familiar");
  }

  const refVinculo = doc(db, COL_VINCULOS, idVinculo(elderUid, cuidadorUid));
  if ((await getDoc(refVinculo)).exists()) throw new ErrorVinculo("Ya estás vinculado con esta persona");

  const batch = writeBatch(db);
  batch.set(refVinculo, { elderUid, cuidadorUid, codigo, creadoEn: Timestamp.now() });
  batch.delete(snapCodigo.ref);
  await batch.commit();
  return elderUid;
}

/** Cuidador: uid del adulto mayor vinculado (para el piloto, uno por cuidador), o null. */
export async function obtenerAdultoVinculado(cuidadorUid: string): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, COL_VINCULOS), where("cuidadorUid", "==", cuidadorUid))
  );
  return snap.empty ? null : (snap.docs[0].data().elderUid as string);
}
