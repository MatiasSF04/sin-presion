import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import { BotonCerrarSesion } from "../../components/shared/BotonCerrarSesion";
import { canjearCodigoVinculo, ErrorVinculo } from "../../services/link.service";
import { esCodigoValido, normalizarCodigo } from "../../services/link.logic";
import s from "./LinkCaregiverPage.module.css";

export function LinkCaregiverPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = esCodigoValido(normalizarCodigo(entrada));

  async function vincular(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !listo) return;
    setEnviando(true);
    setError(null);
    try {
      await canjearCodigoVinculo(appUser.uid, entrada);
      navigate("/caregiver", { replace: true });
    } catch (err) {
      console.error("No se pudo canjear el código de vinculación", err);
      setError(err instanceof ErrorVinculo ? err.message : "No se pudo vincular. Revisa tu conexión.");
      setEnviando(false);
    }
  }

  return (
    <div className={s.pagina}>
      <EncabezadoPagina
        titulo="Conéctate con tu familiar"
        subtitulo="Pídele el código que aparece en su app, en Mi perfil › Compartir con mi cuidador."
      />

      <form onSubmit={vincular} noValidate>
        <label htmlFor="codigo" className={s.etiqueta}>
          Código de vinculación
        </label>
        <input
          id="codigo"
          className={s.campo}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000 000"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="codigo-ayuda"
        />
        <p id="codigo-ayuda" className={s.ayuda}>
          El código vence a los 15 minutos de generarse.
        </p>

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        <Tarjeta variante="suave">
          <p className={s.beneficiosTitulo}>Al vincularte podrás:</p>
          <ul className={s.beneficios}>
            <li>Ver sus mediciones de presión y pulso</li>
            <li>Ayudarle con sus tareas y recordatorios</li>
            <li>Recibir avisos si necesita ayuda</li>
          </ul>
          <p className={s.ayuda}>Tu familiar puede quitar el acceso cuando quiera.</p>
        </Tarjeta>

        <Boton type="submit" bloque disabled={!listo || enviando}>
          {enviando ? "Vinculando…" : "Vincular"}
        </Boton>
      </form>

      <BotonCerrarSesion />
    </div>
  );
}
