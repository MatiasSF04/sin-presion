import type { HTMLAttributes } from "react";
import { unirClases } from "../../estilos/unirClases";
import s from "./Tarjeta.module.css";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** "borde": fondo blanco con borde · "suave": fondo gris sin borde. */
  variante?: "borde" | "suave";
}

export function Tarjeta({ variante = "borde", className, ...resto }: Props) {
  return <div className={unirClases(s.tarjeta, s[variante], className)} {...resto} />;
}
