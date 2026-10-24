import { collection, addDoc, Timestamp, query, where, orderBy, limit, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { VitalReading } from "../types";
import { evaluarMedicion, limpiarObservaciones, type OpcionSigno, type RangoOptimo } from "./vitals.logic";
import { aplicarMetas, type MetaCampo } from "./perfil.logic";

export type VitalType = VitalReading["type"];

interface VitalFieldConfig {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /**
   * Rango óptimo por defecto (feedback del 23 oct 2026). min/max de arriba son solo los límites
   * del control, que permiten registrar todo el rango; fuera del óptimo se marca la medición.
   */
  optimo?: RangoOptimo;
}

export interface VitalTypeConfig {
  type: VitalType;
  label: string;
  icon: string;
  /** Colores como referencias a los tokens de estilos/tokens.css. */
  color: string;
  colorLight: string;
  fields: VitalFieldConfig[];
  /** Preguntas de selección que acompañan la medición (ej. glicemia en ayunas o después de comer). */
  opciones?: OpcionSigno[];
  /** Muestra un cuadro opcional de observaciones al registrar. */
  conObservaciones?: boolean;
}

export const VITAL_TYPES: VitalTypeConfig[] = [
  {
    type: "presion",
    label: "Presión",
    icon: "❤️",
    color: "var(--color-emergencia)",
    colorLight: "var(--color-emergencia-suave)",
    fields: [
      {
        key: "sistolica", label: "Sistólica", unit: "mmHg", min: 60, max: 220, step: 1, default: 120,
        optimo: { min: 90, max: 120 },
      },
      {
        key: "diastolica", label: "Diastólica", unit: "mmHg", min: 40, max: 140, step: 1, default: 80,
        optimo: { min: 60, max: 80 },
      },
      { key: "pulso", label: "Pulso", unit: "ppm", min: 30, max: 200, step: 1, default: 72 },
    ],
  },
  {
    type: "temperatura",
    label: "Temperatura",
    icon: "🌡️",
    color: "var(--color-advertencia)",
    colorLight: "var(--color-advertencia-suave)",
    fields: [
      {
        key: "valor", label: "Temperatura", unit: "°C", min: 34, max: 42, step: 0.1, default: 36.5,
        optimo: { min: 35.2, max: 37, minExclusivo: true, maxExclusivo: true },
      },
    ],
  },
  {
    type: "sueno",
    label: "Sueño",
    icon: "🌙",
    color: "var(--color-info)",
    colorLight: "var(--color-info-suave)",
    fields: [
      {
        key: "horas", label: "Horas dormidas", unit: "h", min: 0, max: 14, step: 0.5, default: 7,
        optimo: { min: 6, max: 12 },
      },
    ],
  },
  {
    type: "azucar",
    label: "Azúcar",
    icon: "💧",
    color: "var(--color-advertencia)",
    colorLight: "var(--color-advertencia-suave)",
    fields: [
      {
        key: "valor", label: "Glicemia", unit: "mg/dL", min: 40, max: 600, step: 1, default: 100,
        optimo: { min: 60, max: 300 },
      },
    ],
    // feedback 23 oct: distinguir ayunas y postprandial (mismo rango por ahora)
    opciones: [
      {
        key: "momento",
        pregunta: "¿Cuándo te mediste?",
        obligatoria: true,
        valores: [
          { valor: "ayunas", etiqueta: "En ayunas", resumen: "en ayunas" },
          { valor: "postprandial", etiqueta: "Después de comer", resumen: "después de comer" },
        ],
      },
    ],
  },
  {
    type: "pasos",
    label: "Pasos",
    icon: "📈",
    color: "var(--color-exito)",
    colorLight: "var(--color-exito-suave)",
    fields: [{ key: "cantidad", label: "Pasos", unit: "pasos", min: 0, max: 30000, step: 100, default: 1000 }],
  },
  {
    type: "hidratacion",
    label: "Hidratación",
    icon: "🥤",
    color: "var(--color-primario)",
    colorLight: "var(--color-primario-suave)",
    fields: [
      {
        key: "vasos", label: "Vasos de agua", unit: "vasos", min: 0, max: 20, step: 1, default: 4,
        optimo: { min: 4, max: 8, detalle: "8 vasos ≈ 2 litros" },
      },
    ],
  },
  // feedback 23 oct: diuresis y deposiciones. Sin rango óptimo hasta que lo definan los profesionales.
  {
    type: "diuresis",
    label: "Diuresis",
    icon: "🚻",
    color: "var(--color-info)",
    colorLight: "var(--color-info-suave)",
    fields: [{ key: "veces", label: "Veces que orinaste hoy", unit: "veces", min: 0, max: 30, step: 1, default: 5 }],
    conObservaciones: true,
  },
  {
    type: "deposiciones",
    label: "Deposiciones",
    icon: "🧻",
    color: "var(--color-acento)",
    colorLight: "var(--color-exito-suave)",
    fields: [{ key: "veces", label: "Veces hoy", unit: "veces", min: 0, max: 15, step: 1, default: 1 }],
    opciones: [
      {
        key: "normal",
        pregunta: "¿Fue normal?",
        obligatoria: true,
        valores: [
          { valor: "si", etiqueta: "Sí", resumen: "normal" },
          { valor: "no", etiqueta: "No", resumen: "no normal" },
        ],
      },
    ],
    conObservaciones: true,
  },
];

export function getVitalTypeConfig(type: string): VitalTypeConfig | undefined {
  return VITAL_TYPES.find((v) => v.type === type);
}

export async function addVitalReading(
  elderUid: string,
  type: VitalType,
  value: Record<string, number>,
  source: "manual" | "device" = "manual",
  /** Metas del cuidador para este tipo (perfil del adulto mayor); sin ellas se usan los rangos sugeridos. */
  metasDelTipo?: Record<string, MetaCampo>,
  /** Respuestas a las opciones del signo y observaciones opcionales (solo se guardan si existen). */
  extras: { detalle?: Record<string, string>; observaciones?: string } = {}
) {
  if (!elderUid) throw new Error("elderUid requerido para registrar una medición");
  // se guarda el resultado para que el cuidador (resumen y avisos) no tenga que recalcularlo
  const campos = aplicarMetas(getVitalTypeConfig(type)?.fields ?? [], metasDelTipo);
  const { enRango, camposFuera } = evaluarMedicion(campos, value);
  const observaciones = limpiarObservaciones(extras.observaciones ?? "");
  await addDoc(collection(db, "vitalReadings"), {
    elderUid,
    type,
    value,
    source,
    fueraDeRango: !enRango,
    camposFueraDeRango: camposFuera,
    recordedAt: Timestamp.now(),
    ...(extras.detalle && Object.keys(extras.detalle).length > 0 ? { detalle: extras.detalle } : {}),
    ...(observaciones ? { observaciones } : {}),
  });
  return { enRango, camposFuera };
}

export interface StoredVitalReading {
  id: string;
  type: VitalType;
  value: Record<string, number>;
  source: "manual" | "device";
  recordedAt: Date;
  /** Resultado guardado al registrar (desde el commit 8). Las mediciones anteriores no lo tienen. */
  fueraDeRango?: boolean;
  camposFueraDeRango?: string[];
  /** Respuestas a las opciones del signo, p. ej. { momento: "ayunas" }. */
  detalle?: Record<string, string>;
  observaciones?: string;
}

function leerMedicion(id: string, data: Record<string, unknown>): StoredVitalReading {
  return {
    id,
    type: data.type as VitalType,
    value: data.value as Record<string, number>,
    source: data.source as "manual" | "device",
    recordedAt: (data.recordedAt as Timestamp).toDate(),
    fueraDeRango: typeof data.fueraDeRango === "boolean" ? data.fueraDeRango : undefined,
    camposFueraDeRango: Array.isArray(data.camposFueraDeRango) ? (data.camposFueraDeRango as string[]) : undefined,
    detalle: data.detalle && typeof data.detalle === "object" ? (data.detalle as Record<string, string>) : undefined,
    observaciones: typeof data.observaciones === "string" ? data.observaciones : undefined,
  };
}

/**
 * Escucha en vivo las últimas mediciones del adulto mayor (la más reciente primero).
 * Usa el mismo índice compuesto que getRecentVitalReadings (elderUid + recordedAt desc).
 */
export function escucharMediciones(
  elderUid: string,
  onLista: (lecturas: StoredVitalReading[]) => void,
  onError: (e: Error) => void,
  max = 100
): () => void {
  const q = query(
    collection(db, "vitalReadings"),
    where("elderUid", "==", elderUid),
    orderBy("recordedAt", "desc"),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => onLista(snap.docs.map((d) => leerMedicion(d.id, d.data()))),
    onError
  );
}

export async function getRecentVitalReadings(
  elderUid: string,
  max = 50
): Promise<StoredVitalReading[]> {
  const q = query(
    collection(db, "vitalReadings"),
    where("elderUid", "==", elderUid),
    orderBy("recordedAt", "desc"),
    limit(max)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => leerMedicion(d.id, d.data()));
}
