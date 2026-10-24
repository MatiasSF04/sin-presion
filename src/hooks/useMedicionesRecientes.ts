import { useEffect, useState } from "react";
import { escucharMediciones, type StoredVitalReading } from "../services/vitals.service";

interface Respuesta {
  elderUid: string;
  mediciones: StoredVitalReading[];
  error: string | null;
}

/**
 * Últimas mediciones del adulto mayor, en vivo (la más reciente primero).
 * Igual que useUpcomingTasks, "cargando" se deriva comparando el uid con el de la última respuesta.
 */
export function useMedicionesRecientes(elderUid: string | undefined) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!elderUid) return;
    return escucharMediciones(
      elderUid,
      (mediciones) => setRespuesta({ elderUid, mediciones, error: null }),
      (e) => setRespuesta({ elderUid, mediciones: [], error: e.message })
    );
  }, [elderUid]);

  const vigente = !!elderUid && respuesta?.elderUid === elderUid;
  return {
    mediciones: vigente ? respuesta.mediciones : [],
    cargando: !!elderUid && !vigente,
    error: vigente ? respuesta.error : null,
  };
}
