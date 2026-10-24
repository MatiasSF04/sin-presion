import { describe, it, expect } from "vitest";
import {
  aplicarMetas,
  esMetaPersonalizada,
  validarMeta,
  normalizarTelefono,
  esTelefonoValido,
  esMargenValido,
  leerPerfil,
  PERFIL_POR_DEFECTO,
} from "./perfil.logic";
import type { RangoOptimo } from "./vitals.logic";

const temperatura = {
  key: "valor", min: 34, max: 42,
  optimo: { min: 35.2, max: 37, minExclusivo: true, maxExclusivo: true },
};
const sistolica = { key: "sistolica", min: 60, max: 220, optimo: { min: 90, max: 120 } };
// campo sin rango sugerido (como el pulso)
const pulso: { key: string; min: number; max: number; optimo?: RangoOptimo } = { key: "pulso", min: 30, max: 200 };

describe("aplicarMetas", () => {
  it("sin metas devuelve los rangos sugeridos tal cual", () => {
    expect(aplicarMetas([sistolica, pulso], undefined)).toEqual([sistolica, pulso]);
  });

  it("reemplaza min y max, conserva los extremos excluyentes y no toca campos sin rango", () => {
    const [t] = aplicarMetas([temperatura], { valor: { min: 35.5, max: 37.5 } });
    expect(t.optimo).toEqual({ min: 35.5, max: 37.5, minExclusivo: true, maxExclusivo: true });
    const [s, p] = aplicarMetas([sistolica, pulso], { sistolica: { min: 100, max: 140 }, pulso: { min: 50, max: 90 } });
    expect(s.optimo).toEqual({ min: 100, max: 140 });
    expect(p.optimo).toBeUndefined();
  });

  it("detecta si una meta es distinta de la sugerida", () => {
    expect(esMetaPersonalizada({ min: 90, max: 120 }, sistolica.optimo)).toBe(false);
    expect(esMetaPersonalizada({ min: 100, max: 140 }, sistolica.optimo)).toBe(true);
    expect(esMetaPersonalizada(undefined, sistolica.optimo)).toBe(false);
  });
});

describe("validarMeta", () => {
  it("acepta una meta válida", () => {
    expect(validarMeta(100, 140, sistolica)).toBeNull();
  });

  it("rechaza vacíos, mínimo mayor o igual al máximo, y valores fuera del control", () => {
    expect(validarMeta(null, 140, sistolica)).toBe("Ingresa ambos valores.");
    expect(validarMeta(140, 140, sistolica)).toBe("El mínimo debe ser menor que el máximo.");
    expect(validarMeta(50, 140, sistolica)).toBe("Debe estar entre 60 y 220.");
  });
});

describe("contacto y margen", () => {
  it("normaliza y valida teléfonos chilenos", () => {
    expect(normalizarTelefono("+56 9 1234-5678")).toBe("+56912345678");
    expect(esTelefonoValido("+56 9 1234 5678")).toBe(true);
    expect(esTelefonoValido("912345678")).toBe(true);
    expect(esTelefonoValido("1234")).toBe(false);
    expect(esTelefonoValido("")).toBe(false);
  });

  it("el margen debe ser un entero entre 5 y 120 minutos", () => {
    expect(esMargenValido(15)).toBe(true);
    expect(esMargenValido(4)).toBe(false);
    expect(esMargenValido(121)).toBe(false);
    expect(esMargenValido(7.5)).toBe(false);
  });
});

describe("leerPerfil", () => {
  it("sin documento usa los valores por defecto", () => {
    expect(leerPerfil(undefined)).toEqual(PERFIL_POR_DEFECTO);
  });

  it("toma lo guardado y corrige lo que venga mal", () => {
    expect(
      leerPerfil({
        margenAvisoMin: 30,
        metas: { sueno: { horas: { min: 7, max: 10 } } },
        contactoEmergencia: { nombre: "Ana", telefono: "+56912345678" },
      })
    ).toEqual({
      margenAvisoMin: 30,
      metas: { sueno: { horas: { min: 7, max: 10 } } },
      contactoEmergencia: { nombre: "Ana", telefono: "+56912345678" },
    });
    expect(leerPerfil({ margenAvisoMin: 999, contactoEmergencia: { nombre: "Sin número" } })).toEqual(
      PERFIL_POR_DEFECTO
    );
  });
});
