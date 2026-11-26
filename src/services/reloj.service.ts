import { Capacitor } from "@capacitor/core";
import { Health, type HealthDataType } from "@capgo/capacitor-health";
import {
  DIAS_A_REVISAR, inicioDelDia, medicionesDeAzucar, medicionesDeHidratacion, medicionesDePasos, medicionesDePresion,
  medicionesDePulso, medicionesDeSueno, medicionesDeTemperatura, pendientesDeGuardar,
  type CuboDiario, type MedicionReloj, type MuestraSalud, type SesionSueno,
} from "./reloj.logic";
import { guardarMedicionReloj, idsMedicionesDesde } from "./vitals.service";
import { registrarError } from "./errores.service";
import type { MetasSignos } from "./perfil.logic";

/**
 * Datos de salud vía Health Connect (Android). La app del reloj (Samsung Health, Garmin Connect,
 * Fitbit, Zepp, etc.) deja ahí pasos, pulso y sueño; otros equipos o apps pueden dejar presión,
 * glicemia, temperatura y agua. La app los lee con permiso del adulto mayor. No hay Bluetooth directo.
 */
export const TIPOS_RELOJ: HealthDataType[] = [
  "steps", "heartRate", "sleep", "bloodPressure", "bloodGlucose", "bodyTemperature", "dietaryWater",
];

/** Muestras puntuales leídas por tipo (presión, azúcar y temperatura pueden ser varias al día). */
const LIMITE_MUESTRAS = 500;

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
  return (await Health.checkAuthorization({ read: TIPOS_RELOJ, write: [] })).readAuthorized;
}

/** Muestra la pantalla de permisos de Health Connect. Devuelve los tipos concedidos. */
export async function pedirPermisosReloj(): Promise<HealthDataType[]> {
  return (await Health.requestAuthorization({ read: TIPOS_RELOJ, write: [] })).readAuthorized;
}

let sincronizando = false;

/**
 * Lee un tipo y lo convierte en mediciones. Si un tipo falla (p. ej. un dato que el teléfono no
 * soporta), se registra el error y se siguen leyendo los demás.
 */
async function leerTipo(tipo: HealthDataType, leer: () => Promise<MedicionReloj[]>): Promise<MedicionReloj[]> {
  try {
    return await leer();
  } catch (e) {
    registrarError(`reloj.leer.${tipo}`, e);
    return [];
  }
}

/**
 * Trae de Health Connect los datos de los últimos días y guarda los que faltan: pasos, pulso e
 * hidratación de días ya terminados; sueño desde las 11:00 del día en que despertó; presión,
 * azúcar y temperatura apenas existan (incluidas las de hoy).
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
    const muestras = async (dataType: HealthDataType) =>
      (await Health.readSamples({ dataType, startDate, endDate, limit: LIMITE_MUESTRAS })).samples;

    const lecturas: Promise<MedicionReloj[]>[] = [];
    const si = (tipo: HealthDataType, leer: () => Promise<MedicionReloj[]>) => {
      if (permitidos.has(tipo)) lecturas.push(leerTipo(tipo, leer));
    };

    si("steps", async () => {
      const r = await Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" });
      return medicionesDePasos(elderUid, r.samples as CuboDiario[], ahora);
    });
    si("heartRate", async () => {
      const r = await Health.queryAggregated({
        dataType: "heartRate", startDate, endDate, bucket: "day", aggregation: ["average", "min", "max"],
      });
      return medicionesDePulso(elderUid, r.samples as CuboDiario[], ahora);
    });
    si("sleep", async () => medicionesDeSueno(elderUid, (await muestras("sleep")) as SesionSueno[], ahora));
    si("bloodPressure", async () =>
      medicionesDePresion(elderUid, (await muestras("bloodPressure")) as MuestraSalud[], ahora));
    si("bloodGlucose", async () =>
      medicionesDeAzucar(elderUid, (await muestras("bloodGlucose")) as MuestraSalud[], ahora));
    si("bodyTemperature", async () =>
      medicionesDeTemperatura(elderUid, (await muestras("bodyTemperature")) as MuestraSalud[], ahora));
    si("dietaryWater", async () =>
      medicionesDeHidratacion(elderUid, (await muestras("dietaryWater")) as MuestraSalud[], ahora));

    const candidatas = (await Promise.all(lecturas)).flat();
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
