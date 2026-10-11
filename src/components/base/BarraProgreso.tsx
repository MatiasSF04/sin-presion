import type { CSSProperties } from "react";
import s from "./BarraProgreso.module.css";

interface Props {
  /** Porcentaje de avance, de 0 a 100. */
  porcentaje: number;
  /** Texto para lectores de pantalla, p. ej. "Tareas completadas hoy". */
  etiqueta: string;
}

export function BarraProgreso({ porcentaje, etiqueta }: Props) {
  const valor = Math.min(100, Math.max(0, Math.round(porcentaje)));
  return (
    <div
      className={s.pista}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
    >
      {/* El ancho es un valor calculado en tiempo de ejecución: se pasa como variable CSS. */}
      <div className={s.relleno} style={{ "--avance": `${valor}%` } as CSSProperties} />
    </div>
  );
}
