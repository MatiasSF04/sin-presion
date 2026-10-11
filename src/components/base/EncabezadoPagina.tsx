import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import s from "./EncabezadoPagina.module.css";

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Ruta a la que vuelve el botón "←". Si se omite, no se muestra el botón. */
  volverA?: string;
  /** Ícono opcional junto al título (p. ej. el del signo vital). */
  icono?: ReactNode;
}

export function EncabezadoPagina({ titulo, subtitulo, volverA, icono }: Props) {
  const navigate = useNavigate();
  return (
    <header className={s.encabezado}>
      {volverA && (
        <button type="button" className={s.volver} onClick={() => navigate(volverA)} aria-label="Volver">
          <span aria-hidden="true">←</span>
        </button>
      )}
      {icono && (
        <span className={s.icono} aria-hidden="true">
          {icono}
        </span>
      )}
      <div className={s.textos}>
        <h1 className={s.titulo}>{titulo}</h1>
        {subtitulo && <p className={s.subtitulo}>{subtitulo}</p>}
      </div>
    </header>
  );
}
