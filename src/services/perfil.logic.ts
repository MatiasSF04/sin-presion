// Lógica pura (sin Firebase) del perfil del adulto mayor que configura su cuidador:
// margen de aviso por incumplimiento, metas por signo vital y contacto de emergencia.
import type { RangoOptimo } from "./vitals.logic";

/** Minutos que se espera, después de la hora de una tarea, antes de avisar al cuidador. */
export const MARGENES_AVISO_MIN = [5, 10, 15, 30, 60] as const;
export const MARGEN_AVISO_POR_DEFECTO = 15;
/** Límites que validan también las reglas de Firestore. */
export const MARGEN_AVISO_MINIMO = 5;
export const MARGEN_AVISO_MAXIMO = 120;

/** Meta personalizada de un campo. Los extremos excluyentes se heredan del rango sugerido. */
export interface MetaCampo {
  min: number;
  max: number;
}

/** metas[tipo][campo], p. ej. metas.presion.sistolica = { min: 100, max: 140 }. */
export type MetasSignos = Record<string, Record<string, MetaCampo>>;

export interface ContactoEmergencia {
  nombre: string;
  telefono: string;
}

export interface PerfilAdulto {
  margenAvisoMin: number;
  metas: MetasSignos;
  contactoEmergencia: ContactoEmergencia | null;
}

export const PERFIL_POR_DEFECTO: PerfilAdulto = {
  margenAvisoMin: MARGEN_AVISO_POR_DEFECTO,
  metas: {},
  contactoEmergencia: null,
};

/** Campo de un signo vital: límites del control y rango sugerido (compatible con vitals.service). */
interface CampoConRango {
  key: string;
  min: number;
  max: number;
  optimo?: RangoOptimo;
}

/**
 * Reemplaza el rango sugerido de cada campo por la meta del cuidador, si la hay.
 * Solo se personalizan los campos que ya tienen rango sugerido; los extremos
 * excluyentes (ej. temperatura "más de 35,2") se conservan.
 */
export function aplicarMetas<T extends CampoConRango>(
  campos: T[],
  metasDelTipo: Record<string, MetaCampo> | undefined
): T[] {
  if (!metasDelTipo) return campos;
  return campos.map((c) => {
    const meta = metasDelTipo[c.key];
    if (!c.optimo || !meta) return c;
    return { ...c, optimo: { ...c.optimo, min: meta.min, max: meta.max } };
  });
}

/** true si la meta es distinta del rango sugerido (para mostrar "Usar valores sugeridos"). */
export function esMetaPersonalizada(meta: MetaCampo | undefined, sugerido: RangoOptimo | undefined): boolean {
  return !!meta && !!sugerido && (meta.min !== sugerido.min || meta.max !== sugerido.max);
}

/** Valida una meta contra los límites del control. Devuelve el mensaje de error o null. */
export function validarMeta(min: number | null, max: number | null, campo: CampoConRango): string | null {
  if (min === null || max === null) return "Ingresa ambos valores.";
  if (min >= max) return "El mínimo debe ser menor que el máximo.";
  if (min < campo.min || max > campo.max) return `Debe estar entre ${campo.min} y ${campo.max}.`;
  return null;
}

/** Deja solo dígitos y un "+" inicial: "+56 9 1234-5678" → "+56912345678". */
export function normalizarTelefono(texto: string): string {
  const t = texto.trim();
  const digitos = t.replace(/\D/g, "");
  return t.startsWith("+") ? `+${digitos}` : digitos;
}

/** Teléfono de 8 a 15 dígitos, con o sin "+" (ej. +56912345678 o 912345678). */
export function esTelefonoValido(texto: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizarTelefono(texto));
}

export function esMargenValido(min: number): boolean {
  return Number.isInteger(min) && min >= MARGEN_AVISO_MINIMO && min <= MARGEN_AVISO_MAXIMO;
}

/** Lee el documento de Firestore con tolerancia: lo que falte o venga mal toma el valor por defecto. */
export function leerPerfil(datos: Record<string, unknown> | undefined): PerfilAdulto {
  if (!datos) return PERFIL_POR_DEFECTO;
  const margen = typeof datos.margenAvisoMin === "number" && esMargenValido(datos.margenAvisoMin)
    ? datos.margenAvisoMin
    : MARGEN_AVISO_POR_DEFECTO;
  const metas = datos.metas && typeof datos.metas === "object" ? (datos.metas as MetasSignos) : {};
  const c = datos.contactoEmergencia as Partial<ContactoEmergencia> | null | undefined;
  const contacto = c && typeof c.telefono === "string" && c.telefono
    ? { nombre: typeof c.nombre === "string" ? c.nombre : "", telefono: c.telefono }
    : null;
  return { margenAvisoMin: margen, metas, contactoEmergencia: contacto };
}
