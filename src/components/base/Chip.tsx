import type { ButtonHTMLAttributes } from "react";
import { unirClases } from "../../estilos/unirClases";
import s from "./Chip.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  activo: boolean;
  /** "redondo": botón circular de una letra (días de la semana). */
  forma?: "normal" | "redondo";
}

export function Chip({ activo, forma = "normal", className, type = "button", ...resto }: Props) {
  return (
    <button
      type={type}
      aria-pressed={activo}
      className={unirClases(s.chip, forma === "redondo" && s.redondo, activo && s.activo, className)}
      {...resto}
    />
  );
}
