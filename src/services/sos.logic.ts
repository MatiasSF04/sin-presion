// Lógica pura (sin Firebase) del botón de emergencia (SOS).
import type { ContactoEmergencia } from "./perfil.logic";

/** Número público de emergencias médicas en Chile (SAMU), si el cuidador no guardó un contacto. */
export const NUMERO_EMERGENCIA_PUBLICO = "131";

export interface DestinoSos {
  nombre: string;
  telefono: string;
  /** true si es el contacto que guardó el cuidador; false si es el 131. */
  esContacto: boolean;
}

/** A quién llama el botón: al contacto del perfil o, si no hay, al 131. */
export function destinoSos(contacto: ContactoEmergencia | null): DestinoSos {
  if (contacto && contacto.telefono) {
    return { nombre: contacto.nombre || "tu contacto de emergencia", telefono: contacto.telefono, esContacto: true };
  }
  return { nombre: "SAMU", telefono: NUMERO_EMERGENCIA_PUBLICO, esContacto: false };
}

export function enlaceLlamada(telefono: string): string {
  return `tel:${telefono}`;
}

/** Un uso del botón, como se guarda en sosEvents. */
export interface EventoSos {
  id: string;
  elderUid: string;
  telefono: string;
  nombreContacto: string;
  esContacto: boolean;
  creadoEn: Date;
}

export const HORAS_SOS_RECIENTE = 24;

/** El uso más reciente dentro de las últimas `horas`, o null. */
export function sosReciente(eventos: EventoSos[], ahora: Date, horas = HORAS_SOS_RECIENTE): EventoSos | null {
  const desde = ahora.getTime() - horas * 60 * 60 * 1000;
  return eventos
    .filter((e) => e.creadoEn.getTime() >= desde)
    .reduce<EventoSos | null>((masNuevo, e) => (!masNuevo || e.creadoEn > masNuevo.creadoEn ? e : masNuevo), null);
}
