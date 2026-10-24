// Lógica pura (sin Firebase) de los rangos óptimos de signos vitales.
// La app no diagnostica: solo indica si una medición queda dentro o fuera del rango óptimo.

/**
 * Rango óptimo de un campo. Por defecto los extremos se incluyen; con `minExclusivo` o
 * `maxExclusivo` el valor tiene que ser estrictamente mayor o menor (ej. temperatura > 35,2).
 * Más adelante el cuidador podrá ajustarlo por adulto mayor desde el perfil.
 */
export interface RangoOptimo {
  min: number;
  max: number;
  minExclusivo?: boolean;
  maxExclusivo?: boolean;
  /** Aclaración que se muestra junto al rango (ej. "8 vasos ≈ 2 litros"). */
  detalle?: string;
}

/** Lo mínimo de un campo que necesita la evaluación (compatible con la configuración de vitals.service). */
export interface CampoEvaluable {
  key: string;
  label: string;
  unit: string;
  optimo?: RangoOptimo;
}

export interface ResultadoMedicion {
  /** true si ningún campo con rango quedó fuera. Un campo sin rango nunca cuenta como fuera. */
  enRango: boolean;
  /** Claves de los campos fuera de rango, en el orden de la configuración. */
  camposFuera: string[];
}

export function estaEnRango(valor: number, r: RangoOptimo): boolean {
  const sobreMin = r.minExclusivo ? valor > r.min : valor >= r.min;
  const bajoMax = r.maxExclusivo ? valor < r.max : valor <= r.max;
  return sobreMin && bajoMax;
}

export function evaluarMedicion(campos: CampoEvaluable[], valores: Record<string, number>): ResultadoMedicion {
  const camposFuera = campos
    .filter((c) => c.optimo && typeof valores[c.key] === "number" && !estaEnRango(valores[c.key], c.optimo))
    .map((c) => c.key);
  return { enRango: camposFuera.length === 0, camposFuera };
}

/** Número con coma decimal, como se escribe en Chile (35.2 → "35,2"). */
export function formatearNumero(n: number): string {
  return String(n).replace(".", ",");
}

/** "60 a 300 mg/dL" · "más de 35,2 y menos de 37 °C". */
export function describirRango(r: RangoOptimo, unidad: string): string {
  const min = formatearNumero(r.min);
  const max = formatearNumero(r.max);
  const texto =
    !r.minExclusivo && !r.maxExclusivo
      ? `${min} a ${max} ${unidad}`
      : `${r.minExclusivo ? "más de" : "desde"} ${min} y ${r.maxExclusivo ? "menos de" : "hasta"} ${max} ${unidad}`;
  return r.detalle ? `${texto} (${r.detalle})` : texto;
}

/**
 * Nota para la pantalla de registro. Con un solo campo: "Rango óptimo: 6 a 12 h".
 * Con varios: "Rango óptimo: Sistólica 90 a 120 mmHg · Diastólica 60 a 80 mmHg".
 * Devuelve null si ningún campo tiene rango.
 */
export function notaRangoOptimo(campos: CampoEvaluable[]): string | null {
  const conRango = campos.filter((c) => c.optimo);
  if (conRango.length === 0) return null;
  const partes =
    conRango.length === 1 && campos.length === 1
      ? [describirRango(conRango[0].optimo!, conRango[0].unit)]
      : conRango.map((c) => `${c.label} ${describirRango(c.optimo!, c.unit)}`);
  return `Rango óptimo: ${partes.join(" · ")}`;
}

// ---------- ingreso con el teclado numérico ----------

/** Límites del control de un campo (el rango completo que se puede registrar). */
export interface LimitesControl {
  min: number;
  max: number;
  step: number;
}

/** Acepta coma o punto decimal ("36,8" o "36.8"). Devuelve null si no es un número. */
export function parsearNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "" || !/^-?\d*\.?\d*$/.test(limpio) || limpio === "." || limpio === "-") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Deja el valor dentro de los límites del control y con los decimales de su paso (0,1 → 1 decimal). */
export function ajustarAlControl(valor: number, c: LimitesControl): number {
  const decimales = (String(c.step).split(".")[1] ?? "").length;
  const acotado = Math.min(c.max, Math.max(c.min, valor));
  return Number(acotado.toFixed(decimales));
}

// ---------- opciones y observaciones de una medición ----------

/**
 * Pregunta de selección que acompaña a una medición, p. ej. glicemia "¿Cuándo te mediste?"
 * (en ayunas / después de comer) o deposiciones "¿Fue normal?" (sí / no).
 */
export interface OpcionSigno {
  key: string;
  pregunta: string;
  valores: { valor: string; etiqueta: string; /** Texto corto para listas: "en ayunas", "no normal". */ resumen: string }[];
  obligatoria: boolean;
}

/** Largo máximo de las observaciones (también lo validan las reglas de Firestore). */
export const MAX_OBSERVACIONES = 500;

/** Primera pregunta obligatoria sin responder, o null si están todas. */
export function preguntaPendiente(opciones: OpcionSigno[] | undefined, elegidas: Record<string, string>): string | null {
  const falta = (opciones ?? []).find(
    (o) => o.obligatoria && !o.valores.some((v) => v.valor === elegidas[o.key])
  );
  return falta ? falta.pregunta : null;
}

/** "en ayunas" · "no normal": resume lo elegido, en el orden de la configuración. */
export function describirDetalle(opciones: OpcionSigno[] | undefined, detalle: Record<string, string> | undefined): string {
  if (!opciones || !detalle) return "";
  return opciones
    .map((o) => o.valores.find((v) => v.valor === detalle[o.key])?.resumen)
    .filter((r): r is string => !!r)
    .join(" · ");
}

/** Observaciones opcionales: sin espacios sobrantes y con largo máximo; vacías → undefined (no se guardan). */
export function limpiarObservaciones(texto: string): string | undefined {
  const limpio = texto.trim().slice(0, MAX_OBSERVACIONES);
  return limpio === "" ? undefined : limpio;
}
