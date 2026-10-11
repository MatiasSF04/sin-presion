import { collection, addDoc, Timestamp, query, where, orderBy, limit, getDocs, } from "firebase/firestore";
import { db } from "./firebase";
import type { VitalReading } from "../types";

export type VitalType = VitalReading["type"];

interface VitalFieldConfig {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface VitalTypeConfig {
  type: VitalType;
  label: string;
  icon: string;
  /** Colores como referencias a los tokens de estilos/tokens.css. */
  color: string;
  colorLight: string;
  fields: VitalFieldConfig[];
  normalRangeNote?: string;
}

export const VITAL_TYPES: VitalTypeConfig[] = [
  {
    type: "presion",
    label: "Presión",
    icon: "❤️",
    color: "var(--color-emergencia)",
    colorLight: "var(--color-emergencia-suave)",
    fields: [
      { key: "sistolica", label: "Sistólica", unit: "mmHg", min: 60, max: 220, step: 1, default: 120 },
      { key: "diastolica", label: "Diastólica", unit: "mmHg", min: 40, max: 140, step: 1, default: 80 },
      { key: "pulso", label: "Pulso", unit: "ppm", min: 30, max: 200, step: 1, default: 72 },
    ],
    normalRangeNote: "Presión normal: Sistólica 90–120 mmHg · Diastólica 60–80 mmHg",
  },
  {
    type: "temperatura",
    label: "Temperatura",
    icon: "🌡️",
    color: "var(--color-advertencia)",
    colorLight: "var(--color-advertencia-suave)",
    fields: [{ key: "valor", label: "Temperatura", unit: "°C", min: 34, max: 42, step: 0.1, default: 36.5 }],
  },
  {
    type: "sueno",
    label: "Sueño",
    icon: "🌙",
    color: "var(--color-info)",
    colorLight: "var(--color-info-suave)",
    fields: [{ key: "horas", label: "Horas dormidas", unit: "h", min: 0, max: 14, step: 0.5, default: 7 }],
  },
  {
    type: "azucar",
    label: "Azúcar",
    icon: "💧",
    color: "var(--color-advertencia)",
    colorLight: "var(--color-advertencia-suave)",
    fields: [{ key: "valor", label: "Glicemia", unit: "mg/dL", min: 40, max: 400, step: 1, default: 100 }],
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
    fields: [{ key: "vasos", label: "Vasos de agua", unit: "vasos", min: 0, max: 20, step: 1, default: 4 }],
  },
];

export function getVitalTypeConfig(type: string): VitalTypeConfig | undefined {
  return VITAL_TYPES.find((v) => v.type === type);
}

export async function addVitalReading(
  elderUid: string,
  type: VitalType,
  value: Record<string, number>,
  source: "manual" | "device" = "manual"
) {
  if (!elderUid) throw new Error("elderUid requerido para registrar una medición");
  await addDoc(collection(db, "vitalReadings"), {
    elderUid,
    type,
    value,
    source,
    recordedAt: Timestamp.now(),
  });
}

export interface StoredVitalReading {
  id: string;
  type: VitalType;
  value: Record<string, number>;
  source: "manual" | "device";
  recordedAt: Date;
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
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      value: data.value,
      source: data.source,
      recordedAt: (data.recordedAt as Timestamp).toDate(),
    };
  });
}