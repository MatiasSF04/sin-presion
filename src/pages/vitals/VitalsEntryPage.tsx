import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVitalTypeConfig, addVitalReading } from "../../services/vitals.service";
import {
  ajustarAlControl, describirRango, formatearNumero, notaRangoOptimo, parsearNumero, type ResultadoMedicion,
} from "../../services/vitals.logic";
import { useAuth } from "../../context/useAuth";
import { usePerfilAdulto } from "../../hooks/usePerfilAdulto";
import { aplicarMetas } from "../../services/perfil.logic";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Boton } from "../../components/base/Boton";
import { Tarjeta } from "../../components/base/Tarjeta";
import { unirClases } from "../../estilos/unirClases";
import s from "./VitalsEntryPage.module.css";

export function VitalsEntryPage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const { appUser } = useAuth();
  const config = getVitalTypeConfig(type ?? "");
  // metas que configuró su cuidador; mientras no existan se usan los rangos sugeridos
  const { perfil } = usePerfilAdulto(appUser?.uid);
  const metasDelTipo = config ? perfil.metas[config.type] : undefined;

  const [values, setValues] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        config?.fields.map((f) => [f.key, f.default]) ?? []
      ) as Record<string, number>
  );
  // lo que se ve escrito en cada campo mientras se usa el teclado numérico ("36,8")
  const [textos, setTextos] = useState<Record<string, string>>(
    () => Object.fromEntries(config?.fields.map((f) => [f.key, formatearNumero(f.default)]) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<ResultadoMedicion | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  if (!config) {
    return (
      <div className={s.pagina}>
        <EncabezadoPagina titulo="Medición" volverA="/vitals" />
        <p>Tipo de medición no reconocido.</p>
      </div>
    );
  }

  const campo = (key: string) => config.fields.find((f) => f.key === key)!;

  function fijar(fieldKey: string, valor: number) {
    const ajustado = ajustarAlControl(valor, campo(fieldKey));
    setValues((prev) => ({ ...prev, [fieldKey]: ajustado }));
    setTextos((prev) => ({ ...prev, [fieldKey]: formatearNumero(ajustado) }));
  }

  function adjust(fieldKey: string, delta: number) {
    fijar(fieldKey, values[fieldKey] + delta);
  }

  /** Mientras escribe: se acepta cualquier número; los límites se aplican al salir del campo. */
  function escribir(fieldKey: string, texto: string) {
    setTextos((prev) => ({ ...prev, [fieldKey]: texto }));
    const n = parsearNumero(texto);
    if (n !== null) setValues((prev) => ({ ...prev, [fieldKey]: n }));
  }

  /** Al salir del campo: si quedó vacío o inválido vuelve al último valor; si no, se ajusta a los límites. */
  function terminarDeEscribir(fieldKey: string) {
    const n = parsearNumero(textos[fieldKey] ?? "");
    fijar(fieldKey, n ?? values[fieldKey]);
  }

  async function handleSave() {
    const elderUid = appUser?.uid;
    if (!elderUid) return;
    // por si guarda sin salir del campo que estaba escribiendo
    const finales = Object.fromEntries(
      config!.fields.map((f) => [f.key, ajustarAlControl(parsearNumero(textos[f.key] ?? "") ?? values[f.key], f)])
    );
    setSaving(true);
    setErrorGuardar(null);
    try {
      const r = await addVitalReading(elderUid, config!.type, finales, "manual", metasDelTipo);
      setValues(finales);
      setResultado(r);
    } catch (err) {
      console.error("Error guardando medición:", err);
      setErrorGuardar("No se pudo guardar la medición. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const estilo = { "--color-icono": config.colorLight } as CSSProperties;

  const campos = aplicarMetas(config.fields, metasDelTipo);

  if (resultado) {
    const fuera = campos.filter((f) => resultado.camposFuera.includes(f.key));
    // pasos (y cualquier signo sin rango óptimo): no se dice "dentro del rango"
    const tieneRango = campos.some((f) => f.optimo);
    return (
      <div className={s.pagina} style={estilo}>
        <EncabezadoPagina titulo={config.label} subtitulo="Medición guardada" icono={config.icon} />

        <div
          role="status"
          className={unirClases(s.resultado, resultado.enRango ? s.resultadoEnRango : s.resultadoFuera)}
        >
          <p className={s.resultadoTitulo}>
            {!tieneRango ? "✓ Medición guardada" : resultado.enRango ? "✓ Dentro del rango óptimo" : "Fuera del rango óptimo"}
          </p>
          {fuera.map((f) => (
            <p key={f.key} className={s.resultadoDetalle}>
              {f.label}: <strong>{formatearNumero(values[f.key])} {f.unit}</strong>
              {f.optimo && <> · óptimo {describirRango(f.optimo, f.unit)}</>}
            </p>
          ))}
        </div>

        <Boton variante="primario" bloque onClick={() => navigate("/home")}>
          Listo
        </Boton>
      </div>
    );
  }

  const nota = notaRangoOptimo(campos);

  return (
    <div className={s.pagina} style={estilo}>
      <EncabezadoPagina
        titulo={config.label}
        subtitulo="Ingresa tu medición"
        volverA="/vitals"
        icono={config.icon}
      />

      {config.fields.map((field) => (
        <Tarjeta key={field.key} variante="suave">
          <label htmlFor={`campo-${field.key}`} className={s.etiquetaCampo}>{field.label}</label>
          <div className={s.fila}>
            <button
              type="button"
              className={s.paso}
              onClick={() => adjust(field.key, -field.step)}
              aria-label={`Disminuir ${field.label}`}
            >
              −
            </button>
            <div className={s.valor}>
              <input
                id={`campo-${field.key}`}
                className={s.numero}
                type="text"
                inputMode={field.step < 1 ? "decimal" : "numeric"}
                autoComplete="off"
                value={textos[field.key] ?? ""}
                onChange={(e) => escribir(field.key, e.target.value)}
                onBlur={() => terminarDeEscribir(field.key)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                aria-describedby={`unidad-${field.key}`}
              />
              <span id={`unidad-${field.key}`} className={s.unidad}>{field.unit}</span>
            </div>
            <button
              type="button"
              className={s.paso}
              onClick={() => adjust(field.key, field.step)}
              aria-label={`Aumentar ${field.label}`}
            >
              +
            </button>
          </div>
        </Tarjeta>
      ))}

      {nota && <p className={s.nota}>{nota}</p>}
      {errorGuardar && <p className={s.error} role="alert">{errorGuardar}</p>}

      <Boton variante="emergencia" bloque onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "Guardar registro"}
      </Boton>
    </div>
  );
}
