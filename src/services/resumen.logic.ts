// Lógica pura (sin Firebase) del resumen del cuidador: últimas mediciones por signo,
// mediciones fuera de rango de los últimos días y textos de valores y fechas.
import { evaluarMedicion, formatearNumero, type CampoEvaluable } from "./vitals.logic";
import { aplicarMetas, type MetasSignos } from "./perfil.logic";

/** Lo mínimo de una medición guardada (compatible con StoredVitalReading de vitals.service). */
export interface MedicionResumen {
  id: string;
  type: string;
  value: Record<string, number>;
  recordedAt: Date;
  fueraDeRango?: boolean;
  camposFueraDeRango?: string[];
}

/** Lo mínimo de la configuración de un signo (compatible con VitalTypeConfig de vitals.service). */
export interface SignoResumen {
  type: string;
  label: string;
  icon: string;
  fields: (CampoEvaluable & { min: number; max: number })[];
}

export interface EstadoMedicion {
  fuera: boolean;
  camposFuera: string[];
}

export const DIAS_FUERA_DE_RANGO = 7;

/**
 * Si la medición trae el resultado guardado al registrarla, se usa ese (refleja las metas
 * vigentes en ese momento). Las anteriores al commit 8 se evalúan con las metas actuales.
 */
export function estadoMedicion(m: MedicionResumen, signo: SignoResumen | undefined, metas: MetasSignos): EstadoMedicion {
  if (typeof m.fueraDeRango === "boolean") {
    return { fuera: m.fueraDeRango, camposFuera: m.camposFueraDeRango ?? [] };
  }
  if (!signo) return { fuera: false, camposFuera: [] };
  const r = evaluarMedicion(aplicarMetas(signo.fields, metas[signo.type]), m.value);
  return { fuera: !r.enRango, camposFuera: r.camposFuera };
}

/** La medición más reciente de cada signo, en el orden de la configuración. Sin registros → null. */
export function ultimasPorSigno<M extends MedicionResumen>(
  mediciones: M[],
  signos: SignoResumen[]
): { signo: SignoResumen; medicion: M | null }[] {
  return signos.map((signo) => {
    const delSigno = mediciones.filter((m) => m.type === signo.type);
    const medicion = delSigno.reduce<M | null>(
      (masNueva, m) => (!masNueva || m.recordedAt > masNueva.recordedAt ? m : masNueva),
      null
    );
    return { signo, medicion };
  });
}

/** Mediciones fuera de rango desde hace `dias` días, la más reciente primero. */
export function fueraDeRangoRecientes<M extends MedicionResumen>(
  mediciones: M[],
  signos: SignoResumen[],
  metas: MetasSignos,
  ahora: Date,
  dias = DIAS_FUERA_DE_RANGO
): { medicion: M; signo: SignoResumen | undefined; camposFuera: string[] }[] {
  const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
  return mediciones
    .filter((m) => m.recordedAt >= desde)
    .map((m) => {
      const signo = signos.find((s) => s.type === m.type);
      return { medicion: m, signo, ...estadoMedicion(m, signo, metas) };
    })
    .filter((x) => x.fuera)
    .sort((a, b) => b.medicion.recordedAt.getTime() - a.medicion.recordedAt.getTime())
    .map(({ medicion, signo, camposFuera }) => ({ medicion, signo, camposFuera }));
}

/**
 * Valor para mostrar. Presión: "137/78 mmHg · 72 ppm". Un campo: "36,8 °C".
 * Si se pasan `soloCampos`, muestra solo esos (los que quedaron fuera): "Sistólica 150 mmHg".
 */
export function formatearValor(signo: SignoResumen, valor: Record<string, number>, soloCampos?: string[]): string {
  const num = (k: string) => (typeof valor[k] === "number" ? formatearNumero(valor[k]) : "—");
  if (soloCampos && soloCampos.length > 0) {
    return signo.fields
      .filter((f) => soloCampos.includes(f.key))
      .map((f) => `${f.label} ${num(f.key)} ${f.unit}`)
      .join(" · ");
  }
  if (signo.type === "pulso") {
    return `${num("promedio")} ppm promedio (${num("minimo")}–${num("maximo")})`;
  }
  if (signo.type === "presion") {
    const pulso = typeof valor.pulso === "number" ? ` · ${num("pulso")} ppm` : "";
    return `${num("sistolica")}/${num("diastolica")} mmHg${pulso}`;
  }
  return signo.fields.map((f) => `${num(f.key)} ${f.unit}`).join(" · ");
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** "hoy 14:05", "ayer 09:10" o "22/10 18:30" (fecha local del teléfono). */
export function formatearMomento(fecha: Date, ahora: Date): string {
  const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferencia = Math.round((dia(ahora) - dia(fecha)) / (24 * 60 * 60 * 1000));
  if (diferencia === 0) return `hoy ${hora}`;
  if (diferencia === 1) return `ayer ${hora}`;
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)} ${hora}`;
}

/** "Hoy", "Ayer" o "22/10" (día local del teléfono). */
export function etiquetaDia(fecha: Date, ahora: Date): string {
  const momento = formatearMomento(fecha, ahora);
  if (momento.startsWith("hoy")) return "Hoy";
  if (momento.startsWith("ayer")) return "Ayer";
  return momento.split(" ")[0];
}

export interface MedicionDelDia<M extends MedicionResumen> {
  medicion: M;
  signo: SignoResumen | undefined;
  fuera: boolean;
  camposFuera: string[];
}

/**
 * Mediciones de los últimos `dias` días agrupadas por día (el más reciente primero),
 * cada una con su estado dentro o fuera de rango. Para la pantalla de mediciones del cuidador.
 */
export function medicionesPorDia<M extends MedicionResumen>(
  mediciones: M[],
  signos: SignoResumen[],
  metas: MetasSignos,
  ahora: Date,
  dias = DIAS_FUERA_DE_RANGO
): { dia: string; mediciones: MedicionDelDia<M>[] }[] {
  const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
  const grupos: { dia: string; mediciones: MedicionDelDia<M>[] }[] = [];
  [...mediciones]
    .filter((m) => m.recordedAt >= desde)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
    .forEach((m) => {
      const signo = signos.find((s) => s.type === m.type);
      const dia = etiquetaDia(m.recordedAt, ahora);
      let grupo = grupos[grupos.length - 1];
      if (!grupo || grupo.dia !== dia) grupos.push((grupo = { dia, mediciones: [] }));
      grupo.mediciones.push({ medicion: m, signo, ...estadoMedicion(m, signo, metas) });
    });
  return grupos;
}
