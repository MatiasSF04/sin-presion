import { useEffect, useState } from "react";
import { escucharSos } from "../services/sos.service";
import { registrarError } from "../services/errores.service";
import type { EventoSos } from "../services/sos.logic";

interface Respuesta {
  elderUid: string;
  eventos: EventoSos[];
}

/** Usos del botón de emergencia del adulto mayor, en vivo (para el inicio del cuidador). */
export function useEventosSos(elderUid: string | undefined) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!elderUid) return;
    return escucharSos(
      elderUid,
      (eventos) => setRespuesta({ elderUid, eventos }),
      (e) => {
        registrarError("sos.escuchar", e);
        setRespuesta({ elderUid, eventos: [] });
      }
    );
  }, [elderUid]);

  return respuesta && respuesta.elderUid === elderUid ? respuesta.eventos : [];
}
