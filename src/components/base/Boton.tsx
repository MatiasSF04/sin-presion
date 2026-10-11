import type { ButtonHTMLAttributes } from "react";
import { unirClases } from "../../estilos/unirClases";
import s from "./Boton.module.css";

export type VarianteBoton = "primario" | "emergencia" | "secundario" | "agregar" | "enlace";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  /** Ocupa todo el ancho disponible. */
  bloque?: boolean;
}

export function Boton({ variante = "primario", bloque = false, className, type = "button", ...resto }: Props) {
  return (
    <button
      type={type}
      className={unirClases(s.boton, s[variante], bloque && s.bloque, className)}
      {...resto}
    />
  );
}
