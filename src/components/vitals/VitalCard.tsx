import type { CSSProperties } from "react";
import s from "./VitalCard.module.css";

interface VitalCardProps {
  icon: string;
  label: string;
  color: string;
  colorLight: string;
  onClick: () => void;
}

export function VitalCard({ icon, label, color, colorLight, onClick }: VitalCardProps) {
  // Los colores dependen del signo vital: se entregan como variables CSS.
  const colores = { "--color-vital": color, "--color-vital-suave": colorLight } as CSSProperties;
  return (
    <button type="button" onClick={onClick} className={s.tarjeta} style={colores}>
      <span className={s.icono} aria-hidden="true">{icon}</span>
      <span className={s.etiqueta}>{label}</span>
    </button>
  );
}
