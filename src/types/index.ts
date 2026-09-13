// Interfaces TypeScript compartidas del proyecto

export interface Task {
  id: string;
  title: string;
  type: "frequent" | "single";
  completed: boolean;
  dueDate?: string;
}

export interface VitalReading {
  id: string;
  type: "presion" | "temperatura" | "sueno" | "azucar" | "pasos" | "hidratacion" | "otro";
  value: Record<string, number>;
  recordedAt: string;
  source: "manual" | "device";
}
