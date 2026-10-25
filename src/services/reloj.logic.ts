/**
 * Lógica pura de la sincronización con el reloj (Health Connect), sin plugin ni Firebase:
 * qué días se consideran, cómo se resumen pasos, pulso y sueño, y qué mediciones faltan guardar.
 */

/** Días hacia atrás que se revisan en cada sincronización. */
export const DIAS_A_REVISAR = 7;
/** El sueño de la noche que terminó hoy se guarda desde esta hora (ya despertó). */
export const HORA_SUENO_DE_HOY = 11;

export type TipoReloj = "pasos" | "pulso" | "sueno";

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

/** Solo las que aún no están guardadas. */
export function pendientesDeGuardar(candidatas: MedicionReloj[], idsGuardados: Set<string>): MedicionReloj[] {
  return candidatas.filter((m) => !idsGuardados.has(m.id));
}
