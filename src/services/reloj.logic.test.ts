/** Pruebas de reloj.logic: resumen diario de pasos, pulso y sueño desde Health Connect. */
import { describe, it, expect } from "vitest";
import {
  DIAS_A_REVISAR, fechaLocal, idMedicionPuntual, idMedicionReloj, medicionesDeAzucar, medicionesDeHidratacion,
  medicionesDePasos, medicionesDePresion, medicionesDePulso, medicionesDeSueno, medicionesDeTemperatura,
  pendientesDeGuardar, type CuboDiario, type MuestraSalud, type SesionSueno,
} from "./reloj.logic";

const UID = "uid-ana";
// "ahora": domingo 25 oct 2026, 15:00 hora local
const AHORA = new Date(2026, 9, 25, 15, 0);
const dia = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m).toISOString();

describe("medicionesDePasos", () => {
  it("guarda el total de cada día terminado y descarta el día en curso", () => {
    const cubos: CuboDiario[] = [
      { startDate: dia(23), value: 4321.4 },
      { startDate: dia(24), value: 6000, values: { sum: 6000 } },
      { startDate: dia(25), value: 1500 }, // hoy: incompleto
    ];
    const r = medicionesDePasos(UID, cubos, AHORA);
    expect(r.map((m) => [m.fecha, m.valor.cantidad])).toEqual([["2026-10-23", 4321], ["2026-10-24", 6000]]);
    expect(r[0].id).toBe("reloj_uid-ana_pasos_2026-10-23");
    expect(r[0].registradaEn.getHours()).toBe(23);
  });

  it("no guarda días sin pasos ni días fuera de la ventana", () => {
    const cubos: CuboDiario[] = [
      { startDate: dia(24), value: 0 },
      { startDate: dia(25 - DIAS_A_REVISAR - 2), value: 3000 },
    ];
    expect(medicionesDePasos(UID, cubos, AHORA)).toEqual([]);
  });
});

describe("medicionesDePulso", () => {
  it("redondea promedio, mínimo y máximo del día", () => {
    const cubos: CuboDiario[] = [{ startDate: dia(24), value: 71.6, values: { average: 71.6, min: 52.2, max: 118.9 } }];
    const [m] = medicionesDePulso(UID, cubos, AHORA);
    expect(m.valor).toEqual({ promedio: 72, minimo: 52, maximo: 119 });
    expect(m.tipo).toBe("pulso");
  });

  it("sin mínimo y máximo usa el promedio", () => {
    const [m] = medicionesDePulso(UID, [{ startDate: dia(24), value: 65 }], AHORA);
    expect(m.valor).toEqual({ promedio: 65, minimo: 65, maximo: 65 });
  });
});

describe("medicionesDeSueno", () => {
  const noche = (dIni: number, hIni: number, dFin: number, hFin: number, extra: Partial<SesionSueno> = {}): SesionSueno => ({
    startDate: dia(dIni, hIni),
    endDate: dia(dFin, hFin),
    value: (new Date(2026, 9, dFin, hFin).getTime() - new Date(2026, 9, dIni, hIni).getTime()) / 60000,
    sleepState: "asleep",
    ...extra,
  });

  it("agrupa por el día en que despertó y suma siestas del mismo día", () => {
    const r = medicionesDeSueno(UID, [noche(23, 23, 24, 7), noche(24, 15, 24, 16)], AHORA);
    expect(r).toHaveLength(1);
    expect(r[0].fecha).toBe("2026-10-24");
    expect(r[0].valor.horas).toBe(9);
  });

  it("la noche que terminó hoy se guarda solo desde las 11:00", () => {
    const sesion = [noche(24, 23, 25, 7)];
    expect(medicionesDeSueno(UID, sesion, new Date(2026, 9, 25, 9, 0))).toEqual([]);
    expect(medicionesDeSueno(UID, sesion, AHORA)[0].valor.horas).toBe(8);
  });

  it("con etapas descuenta los ratos despierto", () => {
    const s = noche(23, 23, 24, 7, {
      hasStageData: true,
      stages: [
        { stage: "light", durationMinutes: 240 },
        { stage: "awake", durationMinutes: 60 },
        { stage: "deep", durationMinutes: 180 },
      ],
    });
    expect(medicionesDeSueno(UID, [s], AHORA)[0].valor.horas).toBe(7);
  });

  it("ignora sesiones marcadas como despierto o en cama", () => {
    expect(medicionesDeSueno(UID, [noche(23, 23, 24, 7, { sleepState: "awake" })], AHORA)).toEqual([]);
  });
});

const muestra = (d: number, h: number, value: number, extra: Partial<MuestraSalud> = {}): MuestraSalud => ({
  startDate: dia(d, h),
  endDate: dia(d, h),
  value,
  ...extra,
});

describe("medicionesDePresion", () => {
  it("guarda cada medición con sistólica y diastólica enteras, incluidas las de hoy", () => {
    const r = medicionesDePresion(
      UID,
      [muestra(24, 8, 0, { systolic: 128.6, diastolic: 82.2 }), muestra(25, 9, 0, { systolic: 141, diastolic: 90 })],
      AHORA
    );
    expect(r.map((m) => [m.fecha, m.valor])).toEqual([
      ["2026-10-24", { sistolica: 129, diastolica: 82 }],
      ["2026-10-25", { sistolica: 141, diastolica: 90 }],
    ]);
    expect(r[1].id).toBe(idMedicionPuntual(UID, "presion", new Date(2026, 9, 25, 9)));
    expect(r[1].registradaEn.getHours()).toBe(9);
  });

  it("descarta muestras sin diastólica, futuras o fuera de la ventana", () => {
    const r = medicionesDePresion(
      UID,
      [
        muestra(24, 8, 0, { systolic: 120 }),
        muestra(25, 18, 0, { systolic: 120, diastolic: 80 }), // después de "ahora"
        muestra(25 - DIAS_A_REVISAR - 2, 8, 0, { systolic: 120, diastolic: 80 }),
      ],
      AHORA
    );
    expect(r).toEqual([]);
  });
});

describe("medicionesDeAzucar", () => {
  it("redondea mg/dL y convierte mmol/L", () => {
    const r = medicionesDeAzucar(UID, [muestra(25, 7, 98.4), muestra(25, 13, 7, { unit: "mmol/L" })], AHORA);
    expect(r.map((m) => m.valor.valor)).toEqual([98, 126]);
    expect(r[0].tipo).toBe("azucar");
  });
});

describe("medicionesDeTemperatura", () => {
  it("deja un decimal y convierte °F", () => {
    const r = medicionesDeTemperatura(
      UID,
      [muestra(24, 22, 36.84, { unit: "celsius" }), muestra(25, 8, 98.6, { unit: "fahrenheit" })],
      AHORA
    );
    expect(r.map((m) => m.valor.valor)).toEqual([36.8, 37]);
  });
});

describe("medicionesDeHidratacion", () => {
  it("suma los litros de cada día terminado y los convierte a vasos de 250 mL", () => {
    const r = medicionesDeHidratacion(
      UID,
      [
        muestra(24, 9, 0.5, { unit: "liter" }),
        muestra(24, 14, 0.75, { unit: "liter" }),
        muestra(25, 10, 1, { unit: "liter" }), // hoy: se guarda mañana
      ],
      AHORA
    );
    expect(r).toHaveLength(1);
    expect(r[0].valor).toEqual({ vasos: 5 });
    expect(r[0].id).toBe(idMedicionReloj(UID, "hidratacion", "2026-10-24"));
  });

  it("no guarda días con menos de medio vaso", () => {
    expect(medicionesDeHidratacion(UID, [muestra(24, 9, 0.1, { unit: "liter" })], AHORA)).toEqual([]);
  });
});

describe("pendientesDeGuardar", () => {
  it("descarta las mediciones que ya están en Firestore", () => {
    const r = medicionesDePasos(UID, [{ startDate: dia(23), value: 10 }, { startDate: dia(24), value: 20 }], AHORA);
    const guardados = new Set([idMedicionReloj(UID, "pasos", "2026-10-23")]);
    expect(pendientesDeGuardar(r, guardados).map((m) => m.fecha)).toEqual(["2026-10-24"]);
  });
});

describe("fechaLocal", () => {
  it("usa la fecha local, no UTC", () => {
    expect(fechaLocal(new Date(2026, 9, 24, 23, 30))).toBe("2026-10-24");
  });
});
