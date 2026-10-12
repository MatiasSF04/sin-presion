// Lógica pura (sin Firebase) de la vinculación cuidador–adulto mayor.

export const LARGO_CODIGO = 6;
export const MINUTOS_VIGENCIA = 15;

function aleatorioSeguro(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32; // [0, 1)
}

/** Código numérico de 6 dígitos. `aleatorio` se inyecta solo para las pruebas. */
export function generarCodigo(aleatorio: () => number = aleatorioSeguro): string {
  const n = Math.floor(aleatorio() * 10 ** LARGO_CODIGO);
  return n.toString().padStart(LARGO_CODIGO, "0");
}

/** Deja solo los dígitos: acepta "482 917" o "482-917". */
export function normalizarCodigo(entrada: string): string {
  return entrada.replace(/\D/g, "");
}

export function esCodigoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${LARGO_CODIGO}}$`).test(codigo);
}

export function calcularExpiracion(ahora: Date): Date {
  return new Date(ahora.getTime() + MINUTOS_VIGENCIA * 60_000);
}

export function estaVencido(expiraEn: Date, ahora: Date): boolean {
  return expiraEn.getTime() <= ahora.getTime();
}

/** Id determinístico del vínculo; las reglas de Firestore dependen de este formato. */
export function idVinculo(elderUid: string, cuidadorUid: string): string {
  return `${elderUid}_${cuidadorUid}`;
}
