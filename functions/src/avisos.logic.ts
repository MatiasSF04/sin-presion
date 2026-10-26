/**
 * Lógica pura de los avisos al cuidador (sin Firebase), para poder probarla.
 * Las tareas guardan fecha ("YYYY-MM-DD") y hora ("HH:mm") locales de Chile, así que todo
 * se calcula en la zona America/Santiago, sin importar dónde corra el servidor.
 */

export const ZONA_HORARIA = "America/Santiago";
export const CANAL_AVISOS = "avisos-cuidador"; // el mismo canal que crea la app (push.service.ts)

/** Margen de aviso del perfil (minutos): por defecto 15, entre 5 y 120 como en las reglas. */
export const MARGEN_POR_DEFECTO = 15;
export const MARGEN_MINIMO = 5;
export const MARGEN_MAXIMO = 120;
/**
 * Pasado el margen, se avisa durante esta ventana (minutos). Evita avisar tareas muy antiguas,
 * por ejemplo al desplegar la función por primera vez o después de una caída del servicio.
 */
export const VENTANA_AVISO_MIN = 180;
/** Las mediciones fuera de rango se avisan solo si son recientes (las del reloj traen días atrás). */
export const HORAS_MEDICION_RECIENTE = 24;

export interface MomentoChile {
  fecha: string; // YYYY-MM-DD
  minutos: number; // minutos desde las 00:00
}

export interface TareaParaAviso {
  dueDate: string;
  time: string;
  status?: string;
  eliminada?: boolean;
  avisoCuidadorEn?: unknown;
}

export interface Aviso {
  titulo: string;
  cuerpo: string;
  ruta: string;
}

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha y minuto del día en Chile para un instante. */
export function momentoEnChile(instante: Date): MomentoChile {
  const p = Object.fromEntries(formato.formatToParts(instante).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function diasDesdeEpoca(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date((diasDesdeEpoca(fecha) + dias) * 86_400_000).toISOString().slice(0, 10);
}

/** El margen guardado por el cuidador, o el valor por defecto si falta o no es válido. */
export function margenAviso(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return MARGEN_POR_DEFECTO;
  return Math.min(MARGEN_MAXIMO, Math.max(MARGEN_MINIMO, Math.round(valor)));
}

/** Minutos que han pasado desde la hora de la tarea (negativo si aún no llega). */
export function minutosDeAtraso(tarea: Pick<TareaParaAviso, "dueDate" | "time">, ahora: MomentoChile): number {
  return (diasDesdeEpoca(ahora.fecha) - diasDesdeEpoca(tarea.dueDate)) * 1440 + ahora.minutos - minutosDeHora(tarea.time);
}

/** ¿Hay que avisar al cuidador que esta tarea no se cumplió? */
export function debeAvisarIncumplimiento(tarea: TareaParaAviso, margen: number, ahora: MomentoChile): boolean {
  if (tarea.status !== "pending" || tarea.eliminada === true || tarea.avisoCuidadorEn) return false;
  const atraso = minutosDeAtraso(tarea, ahora);
  return atraso >= margen && atraso < margen + VENTANA_AVISO_MIN;
}

/**
 * Tramos (fecha + rango de horas) donde puede haber tareas por avisar. Cubren cualquier margen
 * permitido y la ventana de aviso; si el rango cruza la medianoche se agrega el día anterior.
 */
export function tramosDeBusqueda(ahora: MomentoChile): { fecha: string; desde: string; hasta: string }[] {
  const inicio = ahora.minutos - (MARGEN_MAXIMO + VENTANA_AVISO_MIN);
  const fin = ahora.minutos - MARGEN_MINIMO;
  const tramos: { fecha: string; desde: string; hasta: string }[] = [];
  if (inicio < 0) {
    const ayer = sumarDias(ahora.fecha, -1);
    tramos.push({ fecha: ayer, desde: horaDeMinutos(1440 + inicio), hasta: horaDeMinutos(Math.min(1439, 1440 + fin)) });
  }
  if (fin >= 0) {
    tramos.push({ fecha: ahora.fecha, desde: horaDeMinutos(Math.max(0, inicio)), hasta: horaDeMinutos(fin) });
  }
  return tramos;
}

export function avisoIncumplimiento(nombre: string, titulo: string, hora: string): Aviso {
  return {
    titulo: "Tarea sin cumplir",
    cuerpo: `${nombre} aún no marca «${titulo}» de las ${hora}.`,
    ruta: "/caregiver/tasks",
  };
}

export function avisoSos(nombre: string, evento: { esContacto?: boolean; nombreContacto?: string }): Aviso {
  const destino = evento.esContacto && evento.nombreContacto ? evento.nombreContacto : "al SAMU (131)";
  return {
    titulo: "🚨 Emergencia",
    cuerpo: `${nombre} presionó el botón de emergencia y está llamando a ${destino}.`,
    ruta: "/caregiver",
  };
}

const SIGNOS: Record<string, string> = {
  presion: "Presión",
  temperatura: "Temperatura",
  sueno: "Sueño",
  azucar: "Glicemia",
  hidratacion: "Hidratación",
  pasos: "Pasos",
  pulso: "Pulso",
};

function describirValor(tipo: string, v: Record<string, number>): string {
  switch (tipo) {
    case "presion":
      return `${v.sistolica}/${v.diastolica} mmHg`;
    case "temperatura":
      return `${v.valor} °C`;
    case "sueno":
      return `${v.horas} h`;
    case "azucar":
      return `${v.valor} mg/dL`;
    case "hidratacion":
      return `${v.vasos} vasos`;
    default:
      return Object.values(v ?? {}).join(" / ");
  }
}

export function avisoFueraDeRango(nombre: string, tipo: string, valor: Record<string, number>): Aviso {
  return {
    titulo: "Medición fuera de rango",
    cuerpo: `${nombre}: ${SIGNOS[tipo] ?? tipo} ${describirValor(tipo, valor)}.`,
    ruta: "/caregiver/mediciones",
  };
}

/** ¿La medición es lo bastante reciente para avisar? */
export function esMedicionReciente(registradaEn: Date, ahora: Date): boolean {
  const horas = (ahora.getTime() - registradaEn.getTime()) / 3_600_000;
  return horas >= -1 && horas <= HORAS_MEDICION_RECIENTE;
}
