import { describe, it, expect } from "vitest";
import {
  estaEnRango,
  evaluarMedicion,
  describirRango,
  notaRangoOptimo,
  formatearNumero,
  parsearNumero,
  ajustarAlControl,
  type CampoEvaluable,
} from "./vitals.logic";

const temperatura: CampoEvaluable = {
  key: "valor",
  label: "Temperatura",
  unit: "°C",
  optimo: { min: 35.2, max: 37, minExclusivo: true, maxExclusivo: true },
};
const sueno: CampoEvaluable = { key: "horas", label: "Horas dormidas", unit: "h", optimo: { min: 6, max: 12 } };
const presion: CampoEvaluable[] = [
  { key: "sistolica", label: "Sistólica", unit: "mmHg", optimo: { min: 90, max: 120 } },
  { key: "diastolica", label: "Diastólica", unit: "mmHg", optimo: { min: 60, max: 80 } },
  { key: "pulso", label: "Pulso", unit: "ppm" }, // sin rango: nunca cuenta como fuera
];

describe("rango óptimo: extremos incluidos o excluidos", () => {
  it("con extremos incluidos, 6 y 12 horas de sueño están en rango", () => {
    expect(estaEnRango(6, sueno.optimo!)).toBe(true);
    expect(estaEnRango(12, sueno.optimo!)).toBe(true);
    expect(estaEnRango(5.5, sueno.optimo!)).toBe(false);
    expect(estaEnRango(12.5, sueno.optimo!)).toBe(false);
  });

  it("temperatura: sobre 35,2 y menor a 37 (los extremos quedan fuera)", () => {
    expect(estaEnRango(35.2, temperatura.optimo!)).toBe(false);
    expect(estaEnRango(35.3, temperatura.optimo!)).toBe(true);
    expect(estaEnRango(36.9, temperatura.optimo!)).toBe(true);
    expect(estaEnRango(37, temperatura.optimo!)).toBe(false);
  });
});

describe("evaluarMedicion", () => {
  it("en rango si todos los campos con rango cumplen; un campo sin rango no cuenta", () => {
    expect(evaluarMedicion(presion, { sistolica: 115, diastolica: 75, pulso: 150 })).toEqual({
      enRango: true,
      camposFuera: [],
    });
  });

  it("lista los campos fuera de rango en el orden de la configuración", () => {
    expect(evaluarMedicion(presion, { sistolica: 145, diastolica: 92, pulso: 70 })).toEqual({
      enRango: false,
      camposFuera: ["sistolica", "diastolica"],
    });
  });
});

describe("textos de rango", () => {
  it("usa coma decimal y describe extremos excluidos", () => {
    expect(formatearNumero(35.2)).toBe("35,2");
    expect(describirRango(temperatura.optimo!, "°C")).toBe("más de 35,2 y menos de 37 °C");
    expect(describirRango({ min: 4, max: 8, detalle: "8 vasos ≈ 2 litros" }, "vasos")).toBe(
      "4 a 8 vasos (8 vasos ≈ 2 litros)"
    );
  });

  it("nota de un campo, de varios, y null si ninguno tiene rango", () => {
    expect(notaRangoOptimo([sueno])).toBe("Rango óptimo: 6 a 12 h");
    expect(notaRangoOptimo(presion)).toBe("Rango óptimo: Sistólica 90 a 120 mmHg · Diastólica 60 a 80 mmHg");
    expect(notaRangoOptimo([{ key: "cantidad", label: "Pasos", unit: "pasos" }])).toBeNull();
  });
});

describe("ingreso con el teclado numérico", () => {
  it("acepta coma o punto decimal y rechaza lo que no es número", () => {
    expect(parsearNumero("36,8")).toBe(36.8);
    expect(parsearNumero("36.8")).toBe(36.8);
    expect(parsearNumero(" 120 ")).toBe(120);
    expect(parsearNumero("")).toBeNull();
    expect(parsearNumero("12a")).toBeNull();
    expect(parsearNumero(",")).toBeNull();
  });

  it("ajusta al rango completo del control y a los decimales del paso", () => {
    const temp = { min: 34, max: 42, step: 0.1 };
    expect(ajustarAlControl(36.84, temp)).toBe(36.8);
    expect(ajustarAlControl(50, temp)).toBe(42);
    expect(ajustarAlControl(10, { min: 40, max: 400, step: 1 })).toBe(40);
    expect(ajustarAlControl(7.24, { min: 0, max: 14, step: 0.5 })).toBe(7.2);
  });
});
