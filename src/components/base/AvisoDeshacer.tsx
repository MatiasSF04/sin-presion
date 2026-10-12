import { useEffect, useRef } from "react";
import s from "./AvisoDeshacer.module.css";

interface Props {
  mensaje: string;
  onDeshacer: () => void;
  /** Se llama al vencer el tiempo; quien usa el aviso lo saca de pantalla. */
  onCerrar: () => void;
  /** Más largo de lo habitual en apps: un adulto mayor necesita tiempo para leer y decidir. */
  duracionMs?: number;
}

/** Aviso temporal en la parte inferior con la opción de deshacer la última acción. */
export function AvisoDeshacer({ mensaje, onDeshacer, onCerrar, duracionMs = 8000 }: Props) {
  // la referencia evita reiniciar el temporizador cada vez que la pantalla se vuelve a dibujar
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const id = setTimeout(() => cerrar.current(), duracionMs);
    return () => clearTimeout(id);
  }, [mensaje, duracionMs]);

  return (
    <div className={s.aviso} role="status">
      <span className={s.mensaje}>{mensaje}</span>
      <button type="button" className={s.deshacer} onClick={onDeshacer}>
        Deshacer
      </button>
    </div>
  );
}
