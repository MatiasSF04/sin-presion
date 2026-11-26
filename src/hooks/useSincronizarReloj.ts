import { useCallback, useEffect, useRef, useState } from "react";
import {
  TIPOS_RELOJ, pedirPermisosReloj, permisosReloj, relojDisponible, sincronizarReloj,
} from "../services/reloj.service";
import { registrarError } from "../services/errores.service";
import type { MetasSignos } from "../services/perfil.logic";

export interface MensajeReloj {
  tipo: "exito" | "aviso" | "error";
  titulo: string;
  detalle?: string;
}

/**
 * Quien ya autorizó pasos, pulso y sueño (versión 1.0) recibe una sola vez la pantalla de permisos
 * con los datos nuevos (presión, azúcar, temperatura, agua). Si los rechaza, no se le vuelve a
 * preguntar en cada sincronización. Subir este valor si se agregan más tipos.
 */
const VERSION_PERMISOS = "2";
const CLAVE_PERMISOS = "sinpresion.permisosRelojPedidos";

function permisosYaPedidos(): boolean {
  try {
    return localStorage.getItem(CLAVE_PERMISOS) === VERSION_PERMISOS;
  } catch {
    return false;
  }
}

function marcarPermisosPedidos(): void {
  try {
    localStorage.setItem(CLAVE_PERMISOS, VERSION_PERMISOS);
  } catch {
    // sin almacenamiento solo se volverá a preguntar
  }
}

/** "Se sincronizó 1 dato." · "Se sincronizaron 5 datos." · con 0, aclara que ya estaba al día. */
function detalleSincronizados(n: number): string {
  if (n === 0) return "Se sincronizaron 0 datos: tu reloj ya estaba al día.";
  return n === 1 ? "Se sincronizó 1 dato." : `Se sincronizaron ${n} datos.`;
}

/**
 * Sincronización con el reloj (Health Connect), compartida por Inicio y Registrar medición.
 * - `sincronizar`: la que inicia el adulto mayor; pide permisos si faltan y deja un mensaje.
 * - `sincronizarEnSilencio`: al abrir o volver a la app; solo si ya dio permiso, sin mensajes.
 */
export function useSincronizarReloj(elderUid: string | undefined, metas: MetasSignos) {
  const [disponible, setDisponible] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeReloj | null>(null);

  // las metas llegan después desde Firestore: se leen al momento de sincronizar
  const metasRef = useRef(metas);
  useEffect(() => {
    metasRef.current = metas;
  }, [metas]);

  // Health Connect existe solo en Android: en la web o en iPhone no se muestra nada del reloj
  useEffect(() => {
    let activo = true;
    relojDisponible().then((ok) => activo && setDisponible(ok));
    return () => {
      activo = false;
    };
  }, []);

  const sincronizar = useCallback(async () => {
    if (!elderUid) return;
    setSincronizando(true);
    setMensaje(null);
    try {
      let permisos = await permisosReloj();
      const faltan = permisos.length < TIPOS_RELOJ.length;
      if (permisos.length === 0 || (faltan && !permisosYaPedidos())) {
        permisos = await pedirPermisosReloj();
        marcarPermisosPedidos();
      }
      if (permisos.length === 0) {
        setMensaje({
          tipo: "aviso",
          titulo: "Falta el permiso",
          detalle: "Para traer los datos de tu reloj, permite el acceso en Health Connect.",
        });
        return;
      }
      const n = await sincronizarReloj(elderUid, metasRef.current);
      setMensaje({ tipo: "exito", titulo: "¡Dispositivo sincronizado exitosamente!", detalle: detalleSincronizados(n) });
    } catch (e) {
      registrarError("reloj.sincronizar", e);
      setMensaje({ tipo: "error", titulo: "No se pudo leer tu reloj", detalle: "Intenta de nuevo en un momento." });
    } finally {
      setSincronizando(false);
    }
  }, [elderUid]);

  const sincronizarEnSilencio = useCallback(async () => {
    if (!elderUid) return;
    try {
      if (!(await relojDisponible())) return;
      if ((await permisosReloj()).length === 0) return;
      await sincronizarReloj(elderUid, metasRef.current);
    } catch (e) {
      registrarError("reloj.sincronizarEnSilencio", e);
    }
  }, [elderUid]);

  const limpiarMensaje = useCallback(() => setMensaje(null), []);

  return { disponible, sincronizando, mensaje, sincronizar, sincronizarEnSilencio, limpiarMensaje };
}
