import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { Chip } from "../../components/base/Chip";
import { VITAL_TYPES } from "../../services/vitals.service";
import { formatearNumero, parsearNumero } from "../../services/vitals.logic";
import {
  aplicarMetas, esMetaPersonalizada, esTelefonoValido, validarMeta, MARGENES_AVISO_MIN,
  type MetaCampo, type MetasSignos, type PerfilAdulto,
} from "../../services/perfil.logic";
import { ErrorPerfil, guardarPerfil } from "../../services/perfil.service";
import { registrarError } from "../../services/errores.service";
import s from "./PerfilCuidadorPage.module.css";

/** Solo los signos que tienen rango sugerido se pueden personalizar. */
const SIGNOS_CON_META = VITAL_TYPES.filter((t) => t.fields.some((f) => f.optimo));

type TextoMeta = { min: string; max: string };
type TextosMetas = Record<string, Record<string, TextoMeta>>;

/** Perfil y metas del adulto mayor vinculado. Lo edita el cuidador; el adulto mayor solo lo usa. */
export function PerfilCuidadorPage() {
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);
  const elderUid = vinculo.tipo === "vinculado" ? vinculo.elderUid : undefined;
  const { perfil, cargando, error } = usePerfilAdulto(elderUid);

  if (vinculo.tipo === "sinVinculo") return <Navigate to="/link" replace />;
  const nombre = vinculo.tipo === "vinculado" ? vinculo.nombre : "";

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo="Perfil y metas" subtitulo={nombre} volverA="/caregiver" />

      {vinculo.tipo === "error" && (
        <p className={s.error} role="alert">No se pudo cargar el vínculo. Revisa tu conexión.</p>
      )}
      {error && <p className={s.error} role="alert">No se pudo cargar el perfil: {error}</p>}
      {(vinculo.tipo === "cargando" || cargando) && <p className={s.mensaje}>Cargando…</p>}

      {elderUid && appUser && !cargando && (
        // key: si cambia el adulto mayor, el formulario parte de nuevo con sus datos
        <FormularioPerfil
          key={elderUid}
          elderUid={elderUid}
          cuidadorUid={appUser.uid}
          nombreCuidador={appUser.name}
          nombreAdulto={nombre}
          inicial={perfil}
        />
      )}
    </div>
  );
}

interface PropsFormulario {
  elderUid: string;
  cuidadorUid: string;
  nombreCuidador: string;
  nombreAdulto: string;
  inicial: PerfilAdulto;
}

function textosIniciales(metas: MetasSignos): TextosMetas {
  return Object.fromEntries(
    SIGNOS_CON_META.map((tipo) => [
      tipo.type,
      Object.fromEntries(
        aplicarMetas(tipo.fields, metas[tipo.type])
          .filter((f) => f.optimo)
          .map((f) => [f.key, { min: formatearNumero(f.optimo!.min), max: formatearNumero(f.optimo!.max) }])
      ),
    ])
  );
}

function FormularioPerfil({ elderUid, cuidadorUid, nombreCuidador, nombreAdulto, inicial }: PropsFormulario) {
  const [margen, setMargen] = useState(inicial.margenAvisoMin);
  // si aún no hay contacto, se sugiere al propio cuidador (ojalá siempre haya uno)
  const [contactoNombre, setContactoNombre] = useState(inicial.contactoEmergencia?.nombre ?? nombreCuidador);
  const [contactoTelefono, setContactoTelefono] = useState(inicial.contactoEmergencia?.telefono ?? "");
  const [textos, setTextos] = useState<TextosMetas>(() => textosIniciales(inicial.metas));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const adulto = nombreAdulto || "tu familiar";

  function escribirMeta(tipo: string, campo: string, extremo: "min" | "max", valor: string) {
    setTextos((prev) => ({ ...prev, [tipo]: { ...prev[tipo], [campo]: { ...prev[tipo][campo], [extremo]: valor } } }));
    setMensaje(null);
  }

  function usarSugeridos(tipo: string) {
    setTextos((prev) => ({ ...prev, [tipo]: textosIniciales({})[tipo] }));
    setMensaje(null);
  }

  /** Errores por campo ("presion.sistolica" → mensaje), calculados en cada render. */
  const erroresMetas: Record<string, string> = {};
  const metas: MetasSignos = {};
  for (const tipo of SIGNOS_CON_META) {
    for (const f of tipo.fields.filter((c) => c.optimo)) {
      const t = textos[tipo.type]?.[f.key];
      const min = parsearNumero(t?.min ?? "");
      const max = parsearNumero(t?.max ?? "");
      const err = validarMeta(min, max, f);
      if (err) {
        erroresMetas[`${tipo.type}.${f.key}`] = err;
        continue;
      }
      const meta: MetaCampo = { min: min!, max: max! };
      // solo se guarda lo que difiere de lo sugerido
      if (esMetaPersonalizada(meta, f.optimo)) (metas[tipo.type] ??= {})[f.key] = meta;
    }
  }
  const hayErroresMetas = Object.keys(erroresMetas).length > 0;
  const telefonoInvalido = contactoTelefono.trim() !== "" && !esTelefonoValido(contactoTelefono);

  async function guardar() {
    setMensaje(null);
    if (hayErroresMetas) {
      setMensaje({ tipo: "error", texto: "Revisa las metas marcadas en rojo." });
      return;
    }
    if (telefonoInvalido) {
      setMensaje({ tipo: "error", texto: "Revisa el teléfono de emergencia: debe tener entre 8 y 15 dígitos." });
      return;
    }
    const contacto = contactoTelefono.trim()
      ? { nombre: contactoNombre.trim() || "Contacto de emergencia", telefono: contactoTelefono }
      : null;
    setGuardando(true);
    try {
      await guardarPerfil(elderUid, cuidadorUid, { margenAvisoMin: margen, metas, contactoEmergencia: contacto });
      setMensaje({ tipo: "ok", texto: "Cambios guardados." });
    } catch (e) {
      if (!(e instanceof ErrorPerfil)) registrarError("perfil.guardar", e);
      setMensaje({
        tipo: "error",
        texto: e instanceof ErrorPerfil ? e.message : "No se pudieron guardar los cambios. Revisa tu conexión.",
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Tarjeta>
        <h2 className={s.tituloSeccion}>Aviso por tarea no cumplida</h2>
        <p className={s.texto}>Si {adulto} no marca una tarea, te avisaremos después de:</p>
        <div className={s.opciones} role="group" aria-label="Minutos de espera antes de avisar">
          {MARGENES_AVISO_MIN.map((m) => (
            <Chip key={m} activo={margen === m} onClick={() => { setMargen(m); setMensaje(null); }}>
              {m} min
            </Chip>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className={s.tituloSeccion}>Contacto de emergencia</h2>
        <p className={s.texto}>El botón de emergencia de {adulto} llamará a este número. Si no hay ninguno, llamará al 131.</p>
        <label className={s.etiqueta} htmlFor="contacto-nombre">Nombre</label>
        <input
          id="contacto-nombre"
          className={s.campo}
          value={contactoNombre}
          autoComplete="name"
          onChange={(e) => { setContactoNombre(e.target.value); setMensaje(null); }}
        />
        <label className={s.etiqueta} htmlFor="contacto-telefono">Teléfono</label>
        <input
          id="contacto-telefono"
          className={s.campo}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          value={contactoTelefono}
          aria-invalid={telefonoInvalido}
          onChange={(e) => { setContactoTelefono(e.target.value); setMensaje(null); }}
        />
        {telefonoInvalido && <p className={s.errorCampo}>Debe tener entre 8 y 15 dígitos.</p>}
      </Tarjeta>

      <h2 className={s.seccion}>Metas de signos vitales</h2>
      <p className={s.texto}>
        Fuera de estos rangos, la medición de {adulto} quedará marcada para que la revises. Parten con los valores
        sugeridos; ajústalos si su médico indicó otros.
      </p>

      {SIGNOS_CON_META.map((tipo) => {
        const campos = tipo.fields.filter((f) => f.optimo);
        const personalizado = campos.some((f) => {
          const t = textos[tipo.type]?.[f.key];
          const min = parsearNumero(t?.min ?? "");
          const max = parsearNumero(t?.max ?? "");
          return min !== f.optimo!.min || max !== f.optimo!.max;
        });
        return (
          <Tarjeta key={tipo.type} variante="suave">
            <h3 className={s.tituloSigno}>
              <span aria-hidden="true">{tipo.icon}</span> {tipo.label}
            </h3>
            {campos.map((f) => {
              const t = textos[tipo.type][f.key];
              const err = erroresMetas[`${tipo.type}.${f.key}`];
              const id = `meta-${tipo.type}-${f.key}`;
              return (
                <fieldset key={f.key} className={s.meta}>
                  {campos.length > 1 && <legend className={s.etiqueta}>{f.label}</legend>}
                  <div className={s.metaFila}>
                    <label className={s.metaCampo} htmlFor={`${id}-min`}>
                      <span className={s.metaEtiqueta}>{f.optimo!.minExclusivo ? "Más de" : "Desde"}</span>
                      <input
                        id={`${id}-min`}
                        className={s.campo}
                        inputMode={f.step < 1 ? "decimal" : "numeric"}
                        value={t.min}
                        aria-invalid={!!err}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => escribirMeta(tipo.type, f.key, "min", e.target.value)}
                      />
                    </label>
                    <label className={s.metaCampo} htmlFor={`${id}-max`}>
                      <span className={s.metaEtiqueta}>{f.optimo!.maxExclusivo ? "Menos de" : "Hasta"}</span>
                      <input
                        id={`${id}-max`}
                        className={s.campo}
                        inputMode={f.step < 1 ? "decimal" : "numeric"}
                        value={t.max}
                        aria-invalid={!!err}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => escribirMeta(tipo.type, f.key, "max", e.target.value)}
                      />
                    </label>
                    <span className={s.unidad}>{f.unit}</span>
                  </div>
                  {err && <p className={s.errorCampo}>{err}</p>}
                </fieldset>
              );
            })}
            {personalizado && (
              <Boton variante="secundario" bloque className={s.usarSugeridos} onClick={() => usarSugeridos(tipo.type)}>
                Usar valores sugeridos
              </Boton>
            )}
          </Tarjeta>
        );
      })}

      {mensaje && (
        <p className={mensaje.tipo === "ok" ? s.ok : s.error} role={mensaje.tipo === "ok" ? "status" : "alert"}>
          {mensaje.texto}
        </p>
      )}
      <Boton bloque onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </>
  );
}
