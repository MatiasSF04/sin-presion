/**
 * Pruebas automáticas de la lógica de vinculación cuidador–adulto mayor.
 * Framework: Vitest (npm test).
 */
import { describe, it, expect } from "vitest";
import {
  calcularExpiracion, esCodigoValido, estaVencido, generarCodigo, idVinculo, normalizarCodigo,
  MINUTOS_VIGENCIA,
} from "./link.logic";

describe("generarCodigo", () => {
  it("siempre tiene 6 dígitos, rellenando con ceros a la izquierda", () => {
    expect(generarCodigo(() => 0)).toBe("000000");
    expect(generarCodigo(() => 0.000042)).toBe("000042");
    expect(generarCodigo(() => 0.9999999)).toBe("999999");
  });

  it("con el generador real produce códigos válidos", () => {
    for (let i = 0; i < 200; i++) expect(esCodigoValido(generarCodigo())).toBe(true);
  });
});

describe("normalizarCodigo y esCodigoValido", () => {
  it("acepta el código con espacios o guiones", () => {
    expect(normalizarCodigo("482 917")).toBe("482917");
    expect(normalizarCodigo("482-917")).toBe("482917");
  });

  it("rechaza largos distintos de 6 o caracteres no numéricos", () => {
    expect(esCodigoValido("48291")).toBe(false);
    expect(esCodigoValido("4829170")).toBe(false);
    expect(esCodigoValido("48291a")).toBe(false);
    expect(esCodigoValido("482917")).toBe(true);
  });
});

describe("vigencia del código", () => {
  const ahora = new Date("2026-10-11T20:00:00");

  it(`expira ${MINUTOS_VIGENCIA} minutos después de generarse`, () => {
    expect(calcularExpiracion(ahora).getTime() - ahora.getTime()).toBe(MINUTOS_VIGENCIA * 60_000);
  });

  it("está vigente un minuto antes y vencido justo al cumplirse el plazo", () => {
    const expira = calcularExpiracion(ahora);
    expect(estaVencido(expira, new Date(expira.getTime() - 60_000))).toBe(false);
    expect(estaVencido(expira, expira)).toBe(true);
  });
});

describe("idVinculo", () => {
  it("usa el formato <elderUid>_<cuidadorUid> que esperan las reglas", () => {
    expect(idVinculo("adulto1", "cuidador9")).toBe("adulto1_cuidador9");
  });
});
