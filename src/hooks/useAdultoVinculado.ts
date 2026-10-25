import { useEffect, useState } from "react";
import { obtenerAdultoVinculado } from "../services/link.service";
import { fetchAppUser } from "../services/auth.service";
import { registrarError } from "../services/errores.service";

export type EstadoVinculo =
  | { tipo: "cargando" }
  | { tipo: "sinVinculo" }
  | { tipo: "vinculado"; elderUid: string; nombre: string }
  | { tipo: "error" };

/** Adulto mayor vinculado al cuidador (uid y nombre). Compartido por las pantallas del cuidador. */
export function useAdultoVinculado(cuidadorUid: string | undefined): EstadoVinculo {
  const [estado, setEstado] = useState<EstadoVinculo>({ tipo: "cargando" });

  useEffect(() => {
    if (!cuidadorUid) return;
    let activo = true;
    (async () => {
      try {
        const elderUid = await obtenerAdultoVinculado(cuidadorUid);
        if (!activo) return;
        if (!elderUid) return setEstado({ tipo: "sinVinculo" });
        const adulto = await fetchAppUser(elderUid);
        if (activo) setEstado({ tipo: "vinculado", elderUid, nombre: adulto.name });
      } catch (e) {
        registrarError("vinculo.cargar", e);
        if (activo) setEstado({ tipo: "error" });
      }
    })();
    return () => {
      activo = false;
    };
  }, [cuidadorUid]);

  return estado;
}
