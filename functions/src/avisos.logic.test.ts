/** Pruebas de la lógica de avisos al cuidador (zona horaria de Chile, margen y textos). */
import { describe, it, expect } from "vitest";
import {
  avisoFueraDeRango, avisoIncumplimiento, avisoSos, debeAvisarIncumplimiento, esMedicionReciente, margenAviso,
  minutosDeAtraso, momentoEnChile, sumarDias, tramosDeBusqueda, VENTANA_AVISO_MIN,
} from "./avisos.logic";

const tarea = (dueDate: string, time: string, extra = {}) => ({ dueDate, time, status: "pending", ...extra });

describe("momentoEnChile", () => {
  it("convierte un instante UTC a fecha y hora de Chile (verano, UTC-3)", () => {
    expect(momentoEnChile(new Date("2026-10-25T11:05:00Z"))).toEqual({ fecha: "2026-10-25", minutos: 8 * 60 + 5 });
  });
  it("la medianoche de Chile cae el día anterior en UTC", () => {
    expect(momentoEnChile(new Date("2026-10-26T02:30:00Z"))).toEqual({ fecha: "2026-10-25", minutos: 23 * 60 + 30 });
  });
});

describe("margenAviso", () => {
  it("usa 15 por defecto y respeta los límites 5–120", () => {
    expect(margenAviso(undefined)).toBe(15);
    expect(margenAviso(5)).toBe(5);
    expect(margenAviso(1)).toBe(5);
    expect(margenAviso(500)).toBe(120);
  });
});

describe("debeAvisarIncumplimiento", () => {
  const ahora = { fecha: "2026-10-25", minutos: 8 * 60 + 5 }; // 08:05

  it("avisa cuando se cumplió el margen y la tarea sigue pendiente", () => {
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00"), 5, ahora)).toBe(true);
  });
  it("no avisa antes del margen", () => {
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00"), 15, ahora)).toBe(false);
  });
  it("no avisa tareas completadas, quitadas o ya avisadas", () => {
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00", { status: "done" }), 5, ahora)).toBe(false);
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00", { eliminada: true }), 5, ahora)).toBe(false);
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00", { avisoCuidadorEn: "x" }), 5, ahora)).toBe(false);
  });
  it("no avisa tareas demasiado antiguas (fuera de la ventana)", () => {
    const tarde = { fecha: "2026-10-25", minutos: 8 * 60 + 5 + VENTANA_AVISO_MIN };
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "08:00"), 5, tarde)).toBe(false);
  });
  it("funciona al cruzar la medianoche", () => {
    const pasadaMedianoche = { fecha: "2026-10-26", minutos: 10 };
    expect(minutosDeAtraso(tarea("2026-10-25", "23:55"), pasadaMedianoche)).toBe(15);
    expect(debeAvisarIncumplimiento(tarea("2026-10-25", "23:55"), 15, pasadaMedianoche)).toBe(true);
  });
});

describe("tramosDeBusqueda", () => {
  it("de día busca solo en la fecha de hoy", () => {
    expect(tramosDeBusqueda({ fecha: "2026-10-25", minutos: 12 * 60 })).toEqual([
      { fecha: "2026-10-25", desde: "07:00", hasta: "11:55" },
    ]);
  });
  it("de madrugada incluye el día anterior", () => {
    expect(tramosDeBusqueda({ fecha: "2026-10-26", minutos: 60 })).toEqual([
      { fecha: "2026-10-25", desde: "20:00", hasta: "23:59" },
      { fecha: "2026-10-26", desde: "00:00", hasta: "00:55" },
    ]);
  });
  it("en los primeros minutos del día solo busca ayer", () => {
    expect(tramosDeBusqueda({ fecha: "2026-10-26", minutos: 2 })).toEqual([
      { fecha: "2026-10-25", desde: "19:02", hasta: "23:57" },
    ]);
  });
});

describe("textos de los avisos", () => {
  it("incumplimiento", () => {
    expect(avisoIncumplimiento("Ana", "Losartán", "08:00")).toEqual({
      titulo: "Tarea sin cumplir",
      cuerpo: "Ana aún no marca «Losartán» de las 08:00.",
      ruta: "/caregiver/tasks",
    });
  });
  it("SOS con contacto y sin contacto", () => {
    expect(avisoSos("Ana", { esContacto: true, nombreContacto: "Pedro" }).cuerpo).toContain("llamando a Pedro");
    expect(avisoSos("Ana", { esContacto: false }).cuerpo).toContain("SAMU (131)");
  });
  it("fuera de rango", () => {
    expect(avisoFueraDeRango("Ana", "presion", { sistolica: 150, diastolica: 95, pulso: 80 }).cuerpo).toBe(
      "Ana: Presión 150/95 mmHg."
    );
  });
});

describe("esMedicionReciente y sumarDias", () => {
  it("solo avisa mediciones de las últimas 24 horas", () => {
    const ahora = new Date("2026-10-25T15:00:00Z");
    expect(esMedicionReciente(new Date("2026-10-25T10:00:00Z"), ahora)).toBe(true);
    expect(esMedicionReciente(new Date("2026-10-23T10:00:00Z"), ahora)).toBe(false);
  });
  it("suma días entre meses", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-11-01", -1)).toBe("2026-10-31");
  });
});
