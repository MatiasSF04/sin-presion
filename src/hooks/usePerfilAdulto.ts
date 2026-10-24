import { useEffect, useState } from "react";
import { escucharPerfil } from "../services/perfil.service";
import { PERFIL_POR_DEFECTO, type PerfilAdulto } from "../services/perfil.logic";

interface Respuesta {
  elderUid: string;
  perfil: PerfilAdulto;
  error: string | null;
}

/**
 * Perfil del adulto mayor en vivo (margen de aviso, metas y contacto de emergencia).
 * Lo usan el cuidador (para editarlo) y el adulto mayor (metas al registrar y, luego, el SOS).
 * Igual que useUpcomingTasks, "cargando" se deriva comparando el uid con el de la última respuesta.
 */
export function usePerfilAdulto(elderUid: string | undefined) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!elderUid) return;
    return escucharPerfil(
      elderUid,
      (perfil) => setRespuesta({ elderUid, perfil, error: null }),
      (e) => setRespuesta({ elderUid, perfil: PERFIL_POR_DEFECTO, error: e.message })
    );
  }, [elderUid]);

  const vigente = !!elderUid && respuesta?.elderUid === elderUid;
  return {
    perfil: vigente ? respuesta.perfil : PERFIL_POR_DEFECTO,
    cargando: !!elderUid && !vigente,
    error: vigente ? respuesta.error : null,
  };
}
