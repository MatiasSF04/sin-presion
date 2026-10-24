import { describe, it, expect } from "vitest";
import {
  estadoMedicion,
  ultimasPorSigno,
  fueraDeRangoRecientes,
  formatearValor,
  formatearMomento,
  medicionesPorDia,
  type MedicionResumen,
  type SignoResumen,
} from "./resumen.logic";

const presion: SignoResumen = {
  type: "presion", label: "Presión", icon: "❤️",
  fields: [
    { key: "sistolica", label: "Sistólica", unit: "mmHg", min: 60, max: 220, optimo: { min: 90, max: 120 } },
    { key: "diastolica", label: "Diastólica", unit: "mmHg", min: 40, max: 140, optimo: { min: 60, max: 80 } },
    { key: "pulso", label: "Pulso", unit: "ppm", min: 30, max: 200 },
  ],
};
const sueno: SignoResumen = {
  type: "sueno", label: "Sueño", icon: "🌙",
  fields: [{ key: "horas", label: "Horas dormidas", unit: "h", min: 0, max: 14, optimo: { min: 6, max: 12 } }],
};
const signos = [presion, sueno];

const ahora = new Date(2026, 9, 24, 12, 0); // 24 oct 2026 12:00 (hora local)
const hace = (horas: number) => new Date(ahora.getTime() - horas * 60 * 60 * 1000);
const med = (id: string, type: string, value: Record<string, number>, horas: number, extra: Partial<MedicionResumen> = {}) =>
  ({ id, type, value, recordedAt: hace(horas), ...extra });

describe("estadoMedicion", () => {
  it("usa el resultado guardado si existe, aunque las metas actuales digan otra cosa", () => {
    const m = med("a", "presion", { sistolica: 150, diastolica: 70 }, 1, { fueraDeRango: false, camposFueraDeRango: [] });
    expect(estadoMedicion(m, presion, {})).toEqual({ fuera: false, camposFuera: [] });
  });

  it("sin resultado guardado (medición antigua) evalúa con las metas actuales", () => {
    const m = med("b", "presion", { sistolica: 135, diastolica: 70 }, 1);
    expect(estadoMedicion(m, presion, {})).toEqual({ fuera: true, camposFuera: ["sistolica"] });
    expect(estadoMedicion(m, presion, { presion: { sistolica: { min: 100, max: 140 } } })).toEqual({
      fuera: false,
      camposFuera: [],
    });
  });
});

describe("ultimasPorSigno", () => {
  it("toma la más reciente de cada signo y deja null si no hay registros", () => {
    const r = ultimasPorSigno([med("vieja", "presion", { sistolica: 110 }, 30), med("nueva", "presion", { sistolica: 118 }, 2)], signos);
    expect(r.map((x) => [x.signo.type, x.medicion?.id ?? null])).toEqual([
      ["presion", "nueva"],
      ["sueno", null],
    ]);
  });
});

describe("fueraDeRangoRecientes", () => {
  it("solo las de los últimos 7 días que quedaron fuera, la más reciente primero", () => {
    const r = fueraDeRangoRecientes(
      [
        med("en-rango", "presion", { sistolica: 115, diastolica: 75 }, 1, { fueraDeRango: false }),
        med("fuera-1", "sueno", { horas: 4 }, 30, { fueraDeRango: true, camposFueraDeRango: ["horas"] }),
        med("fuera-2", "presion", { sistolica: 150, diastolica: 75 }, 3),
        med("antigua", "sueno", { horas: 3 }, 24 * 8, { fueraDeRango: true, camposFueraDeRango: ["horas"] }),
      ],
      signos,
      {},
      ahora
    );
    expect(r.map((x) => [x.medicion.id, x.camposFuera])).toEqual([
      ["fuera-2", ["sistolica"]],
      ["fuera-1", ["horas"]],
    ]);
  });
});

describe("textos", () => {
  it("formatea presión, un campo y solo los campos fuera de rango", () => {
    expect(formatearValor(presion, { sistolica: 137, diastolica: 78, pulso: 72 })).toBe("137/78 mmHg · 72 ppm");
    expect(formatearValor(sueno, { horas: 7.5 })).toBe("7,5 h");
    expect(formatearValor(presion, { sistolica: 150, diastolica: 78 }, ["sistolica"])).toBe("Sistólica 150 mmHg");
  });

  it("formatea el momento como hoy, ayer o fecha corta", () => {
    expect(formatearMomento(new Date(2026, 9, 24, 9, 5), ahora)).toBe("hoy 09:05");
    expect(formatearMomento(new Date(2026, 9, 23, 22, 40), ahora)).toBe("ayer 22:40");
    expect(formatearMomento(new Date(2026, 9, 20, 8, 0), ahora)).toBe("20/10 08:00");
  });
});

describe("medicionesPorDia", () => {
  it("agrupa los últimos 7 días por día, la más reciente primero, con su estado", () => {
    const r = medicionesPorDia(
      [
        med("ayer", "sueno", { horas: 4 }, 14, { fueraDeRango: true, camposFueraDeRango: ["horas"] }), // 23/10 22:00
        med("hoy-1", "presion", { sistolica: 115, diastolica: 75 }, 3), // hoy 09:00
        med("hoy-2", "sueno", { horas: 7 }, 1, { fueraDeRango: false }), // hoy 11:00
        med("vieja", "sueno", { horas: 7 }, 24 * 9),
      ],
      signos,
      {},
      ahora
    );
    expect(r.map((g) => [g.dia, g.mediciones.map((x) => [x.medicion.id, x.fuera])])).toEqual([
      ["Hoy", [["hoy-2", false], ["hoy-1", false]]],
      ["Ayer", [["ayer", true]]],
    ]);
  });
});
