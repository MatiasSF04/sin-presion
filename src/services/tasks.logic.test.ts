import { describe, it, expect } from "vitest";
import {
  generateOccurrenceDates,
  computeDayProgress,
  computeAdherence,
  computeWeeklyAdherence,
  buildNotificationPlan,
  notificationId,
  validateDefinition,
  taskState,
  startOfWeek,
  esModificable,
  estaVigente,
  tieneOcurrenciasSiguientes,
  agruparTareasDelDia,
  ocurrenciasModificablesDesde,
  validarCambios,
  generarOcurrencias,
  estaAtrasada,
  esQuitable,
  esTratamientoPorHoras,
  tareasDeManana,
  esMedianoche,
  formatearHora,
  type Task,
  type TaskDefinition,
} from "./tasks.logic";

const base: TaskDefinition = {
  title: "Losartán",
  category: "medicamento",
  time: "08:00",
  startDate: "2026-10-05", // lunes
  recurrence: { kind: "daily" },
  remindBeforeMin: 15,
  notifyMissed: true,
};

function task(over: Partial<Task>): Task {
  return {
    id: "t1",
    elderUid: "u1",
    seriesId: "s1",
    title: "Losartán",
    category: "medicamento",
    dueDate: "2026-10-05",
    time: "08:00",
    remindBeforeMin: 15,
    notifyMissed: true,
    status: "pending",
    ...over,
  };
}

describe("repetición", () => {
  it("none → una sola fecha", () => {
    expect(generateOccurrenceDates({ ...base, recurrence: { kind: "none" } })).toEqual(["2026-10-05"]);
  });
  it("diaria con fin → días inclusivos", () => {
    const r = generateOccurrenceDates({ ...base, endDate: "2026-10-09" });
    expect(r).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  });
  it("diaria sin fin → se limita al horizonte", () => {
    expect(generateOccurrenceDates(base)).toHaveLength(60);
  });
  it("semanal lunes y jueves", () => {
    const r = generateOccurrenceDates({ ...base, recurrence: { kind: "weekly", days: [1, 4] }, endDate: "2026-10-18" });
    expect(r).toEqual(["2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15"]);
  });
  it("personalizada cada 3 días", () => {
    const r = generateOccurrenceDates({ ...base, recurrence: { kind: "custom", everyDays: 3 }, endDate: "2026-10-14" });
    expect(r).toEqual(["2026-10-05", "2026-10-08", "2026-10-11", "2026-10-14"]);
  });
  it("cruza cambio de mes", () => {
    const r = generateOccurrenceDates({ ...base, startDate: "2026-10-30", endDate: "2026-11-02" });
    expect(r).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("validación", () => {
  it("acepta definición válida", () => expect(validateDefinition(base)).toBeNull());
  it("rechaza título vacío", () => expect(validateDefinition({ ...base, title: "  " })).not.toBeNull());
  it("rechaza semanal sin días", () =>
    expect(validateDefinition({ ...base, recurrence: { kind: "weekly", days: [] } })).not.toBeNull());
  it("rechaza personalizada < 2", () =>
    expect(validateDefinition({ ...base, recurrence: { kind: "custom", everyDays: 1 } })).not.toBeNull());
  it("rechaza fin anterior al inicio", () =>
    expect(validateDefinition({ ...base, endDate: "2026-10-01" })).not.toBeNull());
});

describe("progreso y adherencia", () => {
  const now = new Date(2026, 9, 7, 12, 0); // mié 7-oct 12:00
  it("progreso del día", () => {
    const ts = [
      task({ id: "a", dueDate: "2026-10-07", status: "done" }),
      task({ id: "b", dueDate: "2026-10-07" }),
      task({ id: "c", dueDate: "2026-10-08" }),
    ];
    expect(computeDayProgress(ts, "2026-10-07")).toEqual({ done: 1, total: 2, pct: 50 });
  });
  it("día sin tareas → 0/0, 0%", () => {
    expect(computeDayProgress([], "2026-10-07")).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it("las pendientes futuras no bajan la adherencia", () => {
    const ts = [
      task({ id: "a", dueDate: "2026-10-07", time: "08:00", status: "done" }),
      task({ id: "b", dueDate: "2026-10-07", time: "20:00" }), // aún no vence
    ];
    expect(computeAdherence(ts, "2026-10-07", "2026-10-07", now)).toEqual({ done: 1, total: 1, pct: 100 });
  });
  it("las vencidas sin marcar sí cuentan", () => {
    const ts = [
      task({ id: "a", dueDate: "2026-10-06", status: "done" }),
      task({ id: "b", dueDate: "2026-10-06" }),
      task({ id: "c", dueDate: "2026-10-05" }),
      task({ id: "d", dueDate: "2026-10-05", status: "done" }),
    ];
    expect(computeAdherence(ts, "2026-10-05", "2026-10-07", now)).toEqual({ done: 2, total: 4, pct: 50 });
  });
  it("adherencia semanal parte el lunes", () => {
    expect(startOfWeek("2026-10-07")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    const ts = [
      task({ id: "old", dueDate: "2026-10-04" }), // semana anterior, ignorada
      task({ id: "a", dueDate: "2026-10-05", status: "done" }),
    ];
    expect(computeWeeklyAdherence(ts, now)).toEqual({ done: 1, total: 1, pct: 100 });
  });
  it("estado visual", () => {
    expect(taskState(task({ status: "done" }), now)).toBe("done");
    expect(taskState(task({ dueDate: "2026-10-07", time: "08:00" }), now)).toBe("overdue");
    expect(taskState(task({ dueDate: "2026-10-07", time: "18:00" }), now)).toBe("pending");
  });
});

describe("plan de notificaciones", () => {
  const now = new Date(2026, 9, 7, 7, 0); // 07:00
  it("programa aviso previo y aviso de incumplimiento", () => {
    const plan = buildNotificationPlan([task({ dueDate: "2026-10-07" })], now);
    expect(plan.map((p) => p.kind)).toEqual(["reminder", "missed"]);
    expect(plan[0].at).toEqual(new Date(2026, 9, 7, 7, 45));
    expect(plan[1].at).toEqual(new Date(2026, 9, 8, 9, 0));
  });
  it("no programa nada para tareas hechas", () => {
    expect(buildNotificationPlan([task({ status: "done", dueDate: "2026-10-07" })], now)).toEqual([]);
  });
  it("omite el aviso previo si ya pasó, pero mantiene el de incumplimiento", () => {
    const late = new Date(2026, 9, 7, 7, 50);
    const plan = buildNotificationPlan([task({ dueDate: "2026-10-07" })], late);
    expect(plan.map((p) => p.kind)).toEqual(["missed"]);
  });
  it("respeta remindBeforeMin=0 y notifyMissed=false", () => {
    const plan = buildNotificationPlan([task({ remindBeforeMin: 0, notifyMissed: false, dueDate: "2026-10-07" })], now);
    expect(plan).toEqual([]);
  });
  it("recorta al límite y ordena por fecha", () => {
    const ts = Array.from({ length: 50 }, (_, i) => task({ id: `t${i}`, dueDate: `2026-10-${String(8 + (i % 20)).padStart(2, "0")}` }));
    const plan = buildNotificationPlan(ts, now, 60);
    expect(plan).toHaveLength(60);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThanOrEqual(plan[i - 1].at.getTime());
  });
  it("ids estables, positivos y distintos por tipo", () => {
    const a = notificationId("abc", "reminder");
    expect(a).toBe(notificationId("abc", "reminder"));
    expect(a).not.toBe(notificationId("abc", "missed"));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(2_147_483_647);
  });
});

describe("edición por el cuidador", () => {
  it("solo las tareas pendientes son modificables", () => {
    expect(esModificable(task({ status: "pending" }))).toBe(true);
    expect(esModificable(task({ status: "done" }))).toBe(false);
  });

  it("'desde esta fecha' toma las pendientes de esa fecha en adelante y conserva las completadas", () => {
    const serie = [
      task({ id: "a", dueDate: "2026-10-11", status: "pending" }), // anterior: no se toca
      task({ id: "b", dueDate: "2026-10-12", status: "done" }), // completada: historial
      task({ id: "c", dueDate: "2026-10-12", status: "pending" }),
      task({ id: "d", dueDate: "2026-10-13", status: "pending" }),
    ];
    expect(ocurrenciasModificablesDesde(serie, { dueDate: "2026-10-12", time: "08:00" }).map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("una tarea quitada no está vigente; las antiguas sin el campo sí lo están", () => {
    expect(estaVigente(task({}))).toBe(true);
    expect(estaVigente(task({ eliminada: false }))).toBe(true);
    expect(estaVigente(task({ eliminada: true }))).toBe(false);
  });

  it("'desde esta fecha' ignora las ocurrencias ya quitadas", () => {
    const serie = [
      task({ id: "c", dueDate: "2026-10-12", eliminada: true }),
      task({ id: "d", dueDate: "2026-10-13" }),
    ];
    expect(ocurrenciasModificablesDesde(serie, { dueDate: "2026-10-12", time: "08:00" }).map((t) => t.id)).toEqual(["d"]);
  });

  it("valida nombre y hora al editar", () => {
    const ok = { title: "Losartán", category: "medicamento" as const, time: "08:00", remindBeforeMin: 15, notifyMissed: true };
    expect(validarCambios(ok)).toBeNull();
    expect(validarCambios({ ...ok, title: "  " })).toMatch(/nombre/);
    expect(validarCambios({ ...ok, time: "8" })).toMatch(/hora/);
  });
});

describe("opción 'hoy y los días siguientes'", () => {
  it("aparece solo si la serie tiene ocurrencias pendientes posteriores", () => {
    const hoy = task({ id: "h", seriesId: "s1", dueDate: "2026-10-12" });
    expect(tieneOcurrenciasSiguientes([hoy, task({ id: "m", seriesId: "s1", dueDate: "2026-10-13" })], hoy)).toBe(true);
    expect(tieneOcurrenciasSiguientes([hoy], hoy)).toBe(false); // tarea única
    expect(tieneOcurrenciasSiguientes([hoy, task({ id: "o", seriesId: "s2", dueDate: "2026-10-13" })], hoy)).toBe(false); // otra serie
    expect(tieneOcurrenciasSiguientes([hoy, task({ id: "m", seriesId: "s1", dueDate: "2026-10-13", status: "done" })], hoy)).toBe(false);
  });
});

describe("vista del día para el cuidador", () => {
  it("separa pendientes y completadas del día, ordenadas por hora, sin mezclar otros días", () => {
    const r = agruparTareasDelDia(
      [
        task({ id: "tarde", dueDate: "2026-10-12", time: "18:00" }),
        task({ id: "hecha", dueDate: "2026-10-12", time: "08:00", status: "done" }),
        task({ id: "manana", dueDate: "2026-10-12", time: "09:00" }),
        task({ id: "otroDia", dueDate: "2026-10-13", time: "07:00" }),
      ],
      "2026-10-12"
    );
    expect(r.pendientes.map((t) => t.id)).toEqual(["manana", "tarde"]);
    expect(r.completadas.map((t) => t.id)).toEqual(["hecha"]);
  });
});

// ---------- tratamientos cada N horas (5a) ----------

const porHoras: TaskDefinition = {
  ...base,
  title: "Paracetamol 500 mg",
  time: "08:00",
  startDate: "2026-10-14",
  recurrence: { kind: "hours", everyHours: 8 },
  endDate: "2026-10-15",
  endTime: "16:00",
};

describe("tratamiento cada N horas", () => {
  it("genera dosis cada 8 h desde la primera hasta el término (inclusive), cruzando la medianoche", () => {
    expect(generarOcurrencias(porHoras)).toEqual([
      { dueDate: "2026-10-14", time: "08:00" },
      { dueDate: "2026-10-14", time: "16:00" },
      { dueDate: "2026-10-15", time: "00:00" },
      { dueDate: "2026-10-15", time: "08:00" },
      { dueDate: "2026-10-15", time: "16:00" },
    ]);
  });

  it("no pasa del horizonte de 60 días aunque el término sea posterior", () => {
    const r = generarOcurrencias({ ...porHoras, recurrence: { kind: "hours", everyHours: 4 }, endDate: "2027-06-01", endTime: "08:00" });
    expect(r).toHaveLength(60 * 6);
    expect(r[r.length - 1]).toEqual({ dueDate: "2026-12-13", time: "04:00" });
  });

  it("las series por días mantienen la hora fija", () => {
    const r = generarOcurrencias({ ...base, endDate: "2026-10-06" });
    expect(r).toEqual([
      { dueDate: "2026-10-05", time: "08:00" },
      { dueDate: "2026-10-06", time: "08:00" },
    ]);
  });

  it("exige frecuencia entre 1 y 24 h y término posterior a la primera dosis", () => {
    expect(validateDefinition(porHoras)).toBeNull();
    expect(validateDefinition({ ...porHoras, recurrence: { kind: "hours", everyHours: 0 } })).toMatch(/frecuencia/);
    expect(validateDefinition({ ...porHoras, recurrence: { kind: "hours", everyHours: 25 } })).toMatch(/frecuencia/);
    expect(validateDefinition({ ...porHoras, recurrence: { kind: "hours", everyHours: 7.5 } })).toMatch(/frecuencia/);
    expect(validateDefinition({ ...porHoras, endTime: undefined })).toMatch(/término/);
    expect(validateDefinition({ ...porHoras, endDate: "2026-10-14", endTime: "08:00" })).toMatch(/posterior/);
  });

  it("reconoce las tareas de un tratamiento por horas", () => {
    expect(esTratamientoPorHoras(task({ frecuenciaHoras: 8 }))).toBe(true);
    expect(esTratamientoPorHoras(task({}))).toBe(false);
  });
});

describe("'esta y las siguientes' compara fecha y hora", () => {
  const dosis = [
    task({ id: "d08", dueDate: "2026-10-14", time: "08:00" }),
    task({ id: "d16", dueDate: "2026-10-14", time: "16:00" }),
    task({ id: "d00", dueDate: "2026-10-15", time: "00:00" }),
  ];

  it("desde la dosis de las 16:00 no incluye la de las 08:00 del mismo día", () => {
    expect(ocurrenciasModificablesDesde(dosis, dosis[1]).map((t) => t.id)).toEqual(["d16", "d00"]);
  });

  it("la última dosis del día sigue ofreciendo 'siguientes' si hay dosis después de medianoche", () => {
    expect(tieneOcurrenciasSiguientes(dosis, dosis[1])).toBe(true);
    expect(tieneOcurrenciasSiguientes(dosis, dosis[2])).toBe(false);
    // misma fecha, hora posterior: cuenta como siguiente
    expect(tieneOcurrenciasSiguientes(dosis.slice(0, 2), dosis[0])).toBe(true);
  });
});

describe("no se pueden quitar las atrasadas (OE2)", () => {
  const ahora = new Date(2026, 9, 12, 10, 0);

  it("una pendiente cuya hora pasó está atrasada y no se puede quitar", () => {
    const t = task({ dueDate: "2026-10-12", time: "08:00" });
    expect(estaAtrasada(t, ahora)).toBe(true);
    expect(esQuitable(t, ahora)).toBe(false);
  });

  it("una pendiente futura sí se puede quitar; una completada no", () => {
    expect(esQuitable(task({ dueDate: "2026-10-12", time: "12:00" }), ahora)).toBe(true);
    expect(esQuitable(task({ dueDate: "2026-10-12", time: "12:00", status: "done" }), ahora)).toBe(false);
  });

  it("una completada con atraso no cuenta como atrasada", () => {
    expect(estaAtrasada(task({ dueDate: "2026-10-12", time: "08:00", status: "done" }), ahora)).toBe(false);
  });
});

describe("sección Próximas (todo el día de mañana)", () => {
  it("lista solo las pendientes vigentes de mañana, ordenadas por hora, incluida la de 00:00", () => {
    const r = tareasDeManana(
      [
        task({ id: "hoy", dueDate: "2026-10-12", time: "23:00" }),
        task({ id: "clinica", dueDate: "2026-10-13", time: "08:00" }),
        task({ id: "medianoche", dueDate: "2026-10-13", time: "00:00" }),
        task({ id: "quitada", dueDate: "2026-10-13", time: "09:00", eliminada: true }),
        task({ id: "pasado", dueDate: "2026-10-14", time: "08:00" }),
      ],
      "2026-10-12"
    );
    expect(r.map((t) => t.id)).toEqual(["medianoche", "clinica"]);
  });
});

describe("etiqueta de medianoche", () => {
  it("solo 00:00 es medianoche y se muestra aclarada; el resto queda igual", () => {
    expect(esMedianoche("00:00")).toBe(true);
    expect(esMedianoche("12:00")).toBe(false);
    expect(formatearHora("00:00")).toBe("00:00 · medianoche");
    expect(formatearHora("08:30")).toBe("08:30");
  });
});
