import { useEffect, useId, useRef, type ReactNode } from "react";
import s from "./Dialogo.module.css";

interface Props {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  /** Se llama al tocar fuera del cuadro, con la tecla Escape o con el botón atrás del navegador. */
  onCerrar: () => void;
  /** Botones de acción, uno debajo del otro. */
  children: ReactNode;
}

/**
 * Cuadro modal accesible basado en el elemento <dialog> de HTML: bloquea el fondo,
 * atrapa el foco dentro y responde a Escape. Reemplaza a window.confirm, que en
 * celulares se ve pequeño y no permite botones claros.
 */
export function Dialogo({ abierto, titulo, descripcion, onCerrar, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={s.dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      onCancel={(e) => {
        e.preventDefault(); // el cierre lo decide quien usa el diálogo
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar(); // toque en el fondo oscuro
      }}
    >
      <div className={s.contenido}>
        <h2 id={idTitulo} className={s.titulo}>
          {titulo}
        </h2>
        {descripcion && (
          <p id={idDescripcion} className={s.descripcion}>
            {descripcion}
          </p>
        )}
        <div className={s.acciones}>{children}</div>
      </div>
    </dialog>
  );
}
