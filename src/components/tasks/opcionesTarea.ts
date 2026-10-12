import type { TaskCategory } from "../../services/tasks.logic";

/** Opciones compartidas por los formularios de crear y editar tareas. */
export const CATEGORIAS: { value: TaskCategory; label: string }[] = [
  { value: "medicamento", label: "💊 Medicamento" },
  { value: "cita", label: "🩺 Cita" },
  { value: "ejercicio", label: "🚶 Ejercicio" },
  { value: "medicion", label: "❤️ Medición" },
  { value: "otro", label: "📝 Otro" },
];

export const OPCIONES_RECORDATORIO = [
  { value: 0, label: "Sin aviso previo" },
  { value: 5, label: "5 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
];
