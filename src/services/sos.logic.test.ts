import { describe, it, expect } from "vitest";
import { destinoSos, enlaceLlamada, sosReciente, NUMERO_EMERGENCIA_PUBLICO, type EventoSos } from "./sos.logic";

describe("destinoSos", () => {
  it("llama al contacto que guardó el cuidador", () => {
    expect(destinoSos({ nombre: "Ana", telefono: "+56912345678" })).toEqual({
      nombre: "Ana",
      telefono: "+56912345678",
      esContacto: true,
    });
  });

  it("sin contacto (o sin teléfono) llama al 131", () => {
    expect(destinoSos(null)).toEqual({ nombre: "SAMU", telefono: NUMERO_EMERGENCIA_PUBLICO, esContacto: false });
    expect(destinoSos({ nombre: "Ana", telefono: "" }).telefono).toBe("131");
  });

  it("arma el enlace para llamar", () => {
    expect(enlaceLlamada("+56912345678")).toBe("tel:+56912345678");
  });
});

describe("sosReciente", () => {
  const ahora = new Date(2026, 9, 24, 12, 0);
  const evento = (id: string, horasAtras: number): EventoSos => ({
    id, elderUid: "a", telefono: "131", nombreContacto: "SAMU", esContacto: false,
    creadoEn: new Date(ahora.getTime() - horasAtras * 60 * 60 * 1000),
  });

  it("devuelve el más reciente de las últimas 24 horas", () => {
    expect(sosReciente([evento("viejo", 30), evento("hace-5h", 5), evento("hace-1h", 1)], ahora)?.id).toBe("hace-1h");
  });

  it("null si no hubo ninguno en las últimas 24 horas", () => {
    expect(sosReciente([evento("viejo", 30)], ahora)).toBeNull();
    expect(sosReciente([], ahora)).toBeNull();
  });
});
