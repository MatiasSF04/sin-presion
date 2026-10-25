import { Capacitor } from "@capacitor/core";
import { Health, type HealthDataType } from "@capgo/capacitor-health";
import {
  DIAS_A_REVISAR, inicioDelDia, medicionesDePasos, medicionesDePulso, medicionesDeSueno, pendientesDeGuardar,
  type CuboDiario, type MedicionReloj, type SesionSueno,
} from "./reloj.logic";
import { guardarMedicionReloj, idsMedicionesDesde } from "./vitals.service";
import type { MetasSignos } from "./perfil.logic";

/**
 * Datos del reloj vía Health Connect (Android): Samsung Health, Fitbit, Zepp, etc. dejan ahí los
 * datos del reloj y la app los lee con permiso del adulto mayor. No hay Bluetooth directo.
 */
const TIPOS: HealthDataType[] = ["steps", "heartRate", "sleep"];

/** Health Connect existe solo en Android (incluido desde Android 14; antes se instala aparte). */
export async function relojDisponible(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Tipos con permiso de lectura concedido (vacío si nunca se pidieron). */
export async function permisosReloj(): Promise<HealthDataType[]> {
  return (await Health.checkAuthorization({ read: TIPOS, write: [] })).readAuthorized;
}

/** Muestra la pantalla de permisos de Health Connect. Devuelve los tipos concedidos. */
export async function pedirPermisosReloj(): Promise<HealthDataType[]> {
  return (await Health.requestAuthorization({ read: TIPOS, write: [] })).readAuthorized;
}

let sincronizando = false;

/**
 * Trae del reloj los últimos días ya terminados (pasos y pulso) y el sueño, y guarda los que faltan.
 * Devuelve cuántas mediciones nuevas se guardaron (0 si no hay permisos o ya estaba al día).
 */
export async function sincronizarReloj(elderUid: string, metas: MetasSignos = {}, ahora = new Date()): Promise<number> {
  if (!elderUid || sincronizando) return 0;
  sincronizando = true;
  try {
    const permitidos = new Set(await permisosReloj());
    if (permitidos.size === 0) return 0;

    const startDate = inicioDelDia(ahora, DIAS_A_REVISAR + 1).toISOString();
    const endDate = ahora.toISOString();
    const candidatas: MedicionReloj[] = [];

    if (permitidos.has("steps")) {
      const r = await Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" });
      candidatas.push(...medicionesDePasos(elderUid, r.samples as CuboDiario[], ahora));
    }
    if (permitidos.has("heartRate")) {
      const r = await Health.queryAggregated({
        dataType: "heartRate", startDate, endDate, bucket: "day", aggregation: ["average", "min", "max"],
      });
      candidatas.push(...medicionesDePulso(elderUid, r.samples as CuboDiario[], ahora));
    }
    if (permitidos.has("sleep")) {
      const r = await Health.readSamples({ dataType: "sleep", startDate, endDate, limit: 500 });
      candidatas.push(...medicionesDeSueno(elderUid, r.samples as SesionSueno[], ahora));
    }
    if (candidatas.length === 0) return 0;

    const guardados = await idsMedicionesDesde(elderUid, inicioDelDia(ahora, DIAS_A_REVISAR + 1));
    const nuevas = pendientesDeGuardar(candidatas, guardados);
    const resultados = await Promise.allSettled(
      nuevas.map((m) => guardarMedicionReloj(elderUid, m.id, m.tipo, m.valor, m.registradaEn, metas[m.tipo]))
    );
    return resultados.filter((r) => r.status === "fulfilled").length;
  } finally {
    sincronizando = false;
  }
}
