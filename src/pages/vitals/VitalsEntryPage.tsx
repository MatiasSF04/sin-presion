import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVitalTypeConfig, addVitalReading } from "../../services/vitals.service";
import { useAuth } from "../../context/useAuth";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Boton } from "../../components/base/Boton";
import { Tarjeta } from "../../components/base/Tarjeta";
import s from "./VitalsEntryPage.module.css";

export function VitalsEntryPage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const { appUser } = useAuth();
  const config = getVitalTypeConfig(type ?? "");

  const [values, setValues] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        config?.fields.map((f) => [f.key, f.default]) ?? []
      ) as Record<string, number>
  );
  const [saving, setSaving] = useState(false);

  if (!config) {
    return (
      <div className={s.pagina}>
        <EncabezadoPagina titulo="Medición" volverA="/vitals" />
        <p>Tipo de medición no reconocido.</p>
      </div>
    );
  }

  function adjust(fieldKey: string, delta: number) {
    const field = config!.fields.find((f) => f.key === fieldKey)!;
    setValues((prev) => {
      const next = Math.round((prev[fieldKey] + delta) * 100) / 100;
      return { ...prev, [fieldKey]: Math.min(field.max, Math.max(field.min, next)) };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const elderUid = appUser?.uid;
      if (!elderUid) return;
      await addVitalReading(elderUid, config!.type, values, "manual");
      navigate("/home");
    } catch (err) {
      console.error("Error guardando medición:", err);
      setSaving(false);
    }
  }

  return (
    <div className={s.pagina} style={{ "--color-icono": config.colorLight } as CSSProperties}>
      <EncabezadoPagina
        titulo={config.label}
        subtitulo="Ingresa tu medición"
        volverA="/vitals"
        icono={config.icon}
      />

      {config.fields.map((field) => (
        <Tarjeta key={field.key} variante="suave">
          <p className={s.etiquetaCampo}>{field.label}</p>
          <div className={s.fila}>
            <button
              type="button"
              className={s.paso}
              onClick={() => adjust(field.key, -field.step)}
              aria-label={`Disminuir ${field.label}`}
            >
              −
            </button>
            <div className={s.valor} aria-live="polite">
              <span className={s.numero}>{values[field.key]}</span>
              <span className={s.unidad}>{field.unit}</span>
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

      {config.normalRangeNote && <p className={s.nota}>{config.normalRangeNote}</p>}

      <Boton variante="emergencia" bloque onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "Guardar registro"}
      </Boton>
    </div>
  );
}
