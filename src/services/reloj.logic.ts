/**
 * Lógica pura de la sincronización con Health Connect, sin plugin ni Firebase: qué días se
 * consideran, cómo se resumen los datos y qué mediciones faltan guardar.
 * - Del reloj: pasos, pulso y sueño (resumen por día).
 * - De otros equipos o apps que escriban en Health Connect (tensiómetro, glucómetro, termómetro,
 *   registro de agua): presión, azúcar y temperatura (cada medición) e hidratación (total por día).
 */

/** Días hacia atrás que se revisan en cada sincronización. */
export const DIAS_A_REVISAR = 7;
/** El sueño de la noche que terminó hoy se guarda desde esta hora (ya despertó). */
export const HORA_SUENO_DE_HOY = 11;
/** Un vaso de agua (8 vasos ≈ 2 litros, igual que el rango óptimo de hidratación). */
export const ML_POR_VASO = 250;

export type TipoReloj = "pasos" | "pulso" | "sueno" | "presion" | "azucar" | "temperatura" | "hidratacion";

export interface MedicionReloj {
  id: string;
  tipo: TipoReloj;
  fecha: string; // YYYY-MM-DD (fecha local)
  valor: Record<string, number>;
  registradaEn: Date;
}

/** Resultado de una consulta agregada por día de Health Connect. */
export interface CuboDiario {
  startDate: string;
  value: number;
  values?: Partial<Record<"sum" | "average" | "min" | "max", number>>;
}

/** Sesión de sueño de Health Connect. */
export interface SesionSueno {
  startDate: string;
  endDate: string;
  value: number; // minutos
  sleepState?: string;
  hasStageData?: boolean;
  stages?: { stage: string; durationMinutes: number }[];
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha local "YYYY-MM-DD". */
export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Inicio (00:00 local) del día que está `dias` antes de `ahora`. */
export function inicioDelDia(ahora: Date, dias = 0): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - dias);
}

/** Id fijo de una medición del reloj: evita duplicados al sincronizar varias veces. */
export function idMedicionReloj(elderUid: string, tipo: TipoReloj, fecha: string): string {
  return `reloj_${elderUid}_${tipo}_${fecha}`;
}

/** ¿La fecha es un día ya terminado y dentro de la ventana revisada? */
function esDiaCompleto(fecha: string, ahora: Date): boolean {
  return fecha < fechaLocal(ahora) && fecha >= fechaLocal(inicioDelDia(ahora, DIAS_A_REVISAR));
}

function finDelDia(fecha: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d, 23, 59, 0);
}

/** Total de pasos por día ya terminado (los días sin pasos no se guardan). */
export function medicionesDePasos(elderUid: string, cubos: CuboDiario[], ahora: Date): MedicionReloj[] {
  return cubos
    .map((c) => ({ fecha: fechaLocal(new Date(c.startDate)), total: Math.round(c.values?.sum ?? c.value) }))
    .filter((c) => esDiaCompleto(c.fecha, ahora) && c.total > 0)
    .map((c) => ({
      id: idMedicionReloj(elderUid, "pasos", c.fecha),
      tipo: "pasos" as const,
      fecha: c.fecha,
      valor: { cantidad: c.total },
      registradaEn: finDelDia(c.fecha),
    }));
}

/** Pulso promedio, mínimo y máximo por día ya terminado. */
export function medicionesDePulso(elderUid: string, cubos: CuboDiario[], ahora: Date): MedicionReloj[] {
  return cubos
    .map((c) => ({
      fecha: fechaLocal(new Date(c.startDate)),
      promedio: c.values?.average ?? c.value,
      minimo: c.values?.min,
      maximo: c.values?.max,
    }))
    .filter((c) => esDiaCompleto(c.fecha, ahora) && c.promedio > 0)
    .map((c) => ({
      id: idMedicionReloj(elderUid, "pulso", c.fecha),
      tipo: "pulso" as const,
      fecha: c.fecha,
      valor: {
        promedio: Math.round(c.promedio),
        minimo: Math.round(c.minimo ?? c.promedio),
        maximo: Math.round(c.maximo ?? c.promedio),
      },
      registradaEn: finDelDia(c.fecha),
    }));
}

const NO_DORMIDO = new Set(["awake", "inBed"]);

/** Minutos realmente dormidos de una sesión (sin los ratos despierto, si hay etapas). */
function minutosDormidos(s: SesionSueno): number {
  if (s.hasStageData && s.stages && s.stages.length > 0) {
    return s.stages.filter((e) => !NO_DORMIDO.has(e.stage)).reduce((t, e) => t + e.durationMinutes, 0);
  }
  return s.sleepState && NO_DORMIDO.has(s.sleepState) ? 0 : s.value;
}

/**
 * Horas dormidas por noche: las sesiones se agrupan por la fecha en que terminaron (el día en que
 * despertó). La noche que terminó hoy se guarda solo desde las 11:00, cuando ya no seguirá durmiendo.
 */
export function medicionesDeSueno(elderUid: string, sesiones: SesionSueno[], ahora: Date): MedicionReloj[] {
  const hoy = fechaLocal(ahora);
  const desde = fechaLocal(inicioDelDia(ahora, DIAS_A_REVISAR));
  const porNoche = new Map<string, { minutos: number; despertar: Date }>();
  for (const s of sesiones) {
    const fin = new Date(s.endDate);
    if (fin > ahora) continue;
    const fecha = fechaLocal(fin);
    if (fecha < desde || fecha > hoy) continue;
    if (fecha === hoy && ahora.getHours() < HORA_SUENO_DE_HOY) continue;
    const previa = porNoche.get(fecha) ?? { minutos: 0, despertar: fin };
    porNoche.set(fecha, {
      minutos: previa.minutos + minutosDormidos(s),
      despertar: fin > previa.despertar ? fin : previa.despertar,
    });
  }
  return [...porNoche.entries()]
    .filter(([, n]) => n.minutos > 0)
    .map(([fecha, n]) => ({
      id: idMedicionReloj(elderUid, "sueno", fecha),
      tipo: "sueno" as const,
      fecha,
      valor: { horas: Math.round((n.minutos / 60) * 10) / 10 },
      registradaEn: n.despertar,
    }));
}

// ---------- mediciones puntuales (presión, azúcar, temperatura) e hidratación ----------

/** Muestra de Health Connect (compatible con HealthSample del plugin). */
export interface MuestraSalud {
  startDate: string;
  endDate: string;
  value: number;
  unit?: string;
  /** Solo presión arterial, en mmHg. */
  systolic?: number;
  diastolic?: number;
}

/**
 * Id fijo de una medición puntual: el instante exacto de la muestra identifica el mismo registro
 * de Health Connect en cada sincronización (dos mediciones en el mismo minuto no chocan).
 */
export function idMedicionPuntual(elderUid: string, tipo: TipoReloj, momento: Date): string {
  return `reloj_${elderUid}_${tipo}_${momento.getTime()}`;
}

/** ¿El momento ya ocurrió y está dentro de la ventana revisada? (incluye hoy) */
function enVentana(momento: Date, ahora: Date): boolean {
  return !Number.isNaN(momento.getTime()) && momento <= ahora && momento >= inicioDelDia(ahora, DIAS_A_REVISAR);
}

function puntual(
  elderUid: string,
  tipo: TipoReloj,
  momento: Date,
  valor: Record<string, number>
): MedicionReloj {
  return { id: idMedicionPuntual(elderUid, tipo, momento), tipo, fecha: fechaLocal(momento), valor, registradaEn: momento };
}

/** Cada medición de presión con sistólica y diastólica, en mmHg enteros. */
export function medicionesDePresion(elderUid: string, muestras: MuestraSalud[], ahora: Date): MedicionReloj[] {
  return muestras
    .map((m) => ({ momento: new Date(m.startDate), sistolica: m.systolic, diastolica: m.diastolic }))
    .filter(
      (m): m is { momento: Date; sistolica: number; diastolica: number } =>
        enVentana(m.momento, ahora) && (m.sistolica ?? 0) > 0 && (m.diastolica ?? 0) > 0
    )
    .map((m) =>
      puntual(elderUid, "presion", m.momento, { sistolica: Math.round(m.sistolica), diastolica: Math.round(m.diastolica) })
    );
}

/** Cada medición de glicemia en mg/dL enteros (si llegara en mmol/L, se convierte). */
export function medicionesDeAzucar(elderUid: string, muestras: MuestraSalud[], ahora: Date): MedicionReloj[] {
  return muestras
    .map((m) => ({
      momento: new Date(m.startDate),
      mgdl: m.unit && m.unit.toLowerCase().startsWith("mmol") ? m.value * 18 : m.value,
    }))
    .filter((m) => enVentana(m.momento, ahora) && m.mgdl > 0)
    .map((m) => puntual(elderUid, "azucar", m.momento, { valor: Math.round(m.mgdl) }));
}

/** Cada medición de temperatura corporal en °C con un decimal (si llegara en °F, se convierte). */
export function medicionesDeTemperatura(elderUid: string, muestras: MuestraSalud[], ahora: Date): MedicionReloj[] {
  return muestras
    .map((m) => ({
      momento: new Date(m.startDate),
      celsius: m.unit === "fahrenheit" ? ((m.value - 32) * 5) / 9 : m.value,
    }))
    .filter((m) => enVentana(m.momento, ahora) && m.celsius > 0)
    .map((m) => puntual(elderUid, "temperatura", m.momento, { valor: Math.round(m.celsius * 10) / 10 }));
}

/**
 * Vasos de agua por día ya terminado: se suman los registros del día (en litros) y se convierten
 * a vasos de ML_POR_VASO. Igual que los pasos, el día en curso se guarda al día siguiente.
 */
export function medicionesDeHidratacion(elderUid: string, muestras: MuestraSalud[], ahora: Date): MedicionReloj[] {
  const mlPorDia = new Map<string, number>();
  for (const m of muestras) {
    const momento = new Date(m.startDate);
    if (Number.isNaN(momento.getTime())) continue;
    const fecha = fechaLocal(momento);
    if (!esDiaCompleto(fecha, ahora)) continue;
    const ml = m.unit === "liter" || m.unit === undefined ? m.value * 1000 : m.value;
    mlPorDia.set(fecha, (mlPorDia.get(fecha) ?? 0) + ml);
  }
  return [...mlPorDia.entries()]
    .map(([fecha, ml]) => ({ fecha, vasos: Math.round(ml / ML_POR_VASO) }))
    .filter((d) => d.vasos > 0)
    .map((d) => ({
      id: idMedicionReloj(elderUid, "hidratacion", d.fecha),
      tipo: "hidratacion" as const,
      fecha: d.fecha,
      valor: { vasos: d.vasos },
      registradaEn: finDelDia(d.fecha),
    }));
}

/** Solo las que aún no están guardadas. */
export function pendientesDeGuardar(candidatas: MedicionReloj[], idsGuardados: Set<string>): MedicionReloj[] {
  return candidatas.filter((m) => !idsGuardados.has(m.id));
}
