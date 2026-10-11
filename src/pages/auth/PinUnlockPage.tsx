import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import {
  clearSavedPin,
  getSavedUid,
  hasSavedPin,
  savePinForDevice,
  signOut,
  verifyPin,
} from "../../services/auth.service";
import { Boton } from "../../components/base/Boton";
import { unirClases } from "../../estilos/unirClases";
import s from "./Acceso.module.css";

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

type Step = "create" | "confirm" | "unlock";

export function PinUnlockPage() {
  const { appUser, setPinUnlocked, refreshPinStatus } = useAuth();

  // Si hay sesión pero no hay PIN guardado para ESTE usuario en este dispositivo, hay que crearlo.
  const needsCreate = !!appUser && (!hasSavedPin() || getSavedUid() !== appUser.uid);

  const [step, setStep] = useState<Step>(needsCreate ? "create" : "unlock");
  const [digits, setDigits] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);

  const title =
    step === "create" ? "Crea tu PIN" : step === "confirm" ? "Confirma tu PIN" : "Ingresa tu PIN";
  const subtitle =
    step === "create"
      ? `Elige ${PIN_LENGTH} números para entrar rápido a la aplicación`
      : step === "confirm"
      ? "Escribe el mismo PIN otra vez"
      : appUser
      ? `Hola, ${appUser.name}`
      : "Desbloquea la aplicación";

  const pushDigit = useCallback(
    (d: string) => {
      if (busy) return;
      setError("");
      setDigits((prev) => (prev.length < PIN_LENGTH ? prev + d : prev));
    },
    [busy]
  );

  const popDigit = useCallback(() => {
    if (busy) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [busy]);

  // Teclado físico (útil al probar en el computador)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
      else if (e.key === "Backspace") popDigit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pushDigit, popDigit]);

  // Cuando se completan los dígitos, se procesa el paso actual
  useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;

    async function process() {
      setBusy(true);
      try {
        if (step === "create") {
          setFirstPin(digits);
          setDigits("");
          setStep("confirm");
        } else if (step === "confirm") {
          if (digits !== firstPin) {
            setError("Los PIN no coinciden. Vuelve a elegirlo.");
            setDigits("");
            setFirstPin("");
            setStep("create");
          } else if (appUser) {
            await savePinForDevice(appUser.uid, digits);
            refreshPinStatus();
            setPinUnlocked(true);
          }
        } else {
          const ok = await verifyPin(digits);
          if (ok) {
            setPinUnlocked(true);
          } else {
            const next = attempts + 1;
            setAttempts(next);
            setDigits("");
            if (next >= MAX_ATTEMPTS) {
              // Demasiados intentos: se exige volver a entrar con correo y contraseña
              await signOut();
              refreshPinStatus();
              setPinUnlocked(false);
            } else {
              setError(`PIN incorrecto. Te quedan ${MAX_ATTEMPTS - next} intento(s).`);
            }
          }
        }
      } catch (err) {
        console.error("Error procesando el PIN:", err);
        setError("Ocurrió un error. Intenta de nuevo.");
        setDigits("");
      } finally {
        setBusy(false);
      }
    }
    process();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  async function handleForgot() {
    // Sin sesión: se borra el PIN local para volver al login.
    // Con sesión: se cierra la sesión (signOut también borra el PIN).
    if (appUser) {
      await signOut();
    } else {
      clearSavedPin();
    }
    refreshPinStatus();
    setPinUnlocked(false);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className={s.pantalla}>
      <div className={s.avatarPin} aria-hidden="true">🔒</div>

      <h1 className={s.titulo}>{title}</h1>
      <p className={s.subtituloPin}>{subtitle}</p>

      <div className={s.puntos} role="status" aria-label={`${digits.length} de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i} className={unirClases(s.punto, i < digits.length && s.puntoLleno)} />
        ))}
      </div>

      <p className={s.errorPin} role="alert">{error || " "}</p>

      <div className={s.teclado}>
        {keys.map((k) => (
          <button key={k} type="button" className={s.tecla} onClick={() => pushDigit(k)}>
            {k}
          </button>
        ))}
        <span />
        <button type="button" className={s.tecla} onClick={() => pushDigit("0")}>
          0
        </button>
        <button type="button" className={s.tecla} onClick={popDigit} aria-label="Borrar">
          ⌫
        </button>
      </div>

      <Boton variante="enlace" onClick={handleForgot}>
        {step === "unlock" ? "¿Olvidaste tu PIN? Entrar con correo" : "Cancelar y volver al inicio"}
      </Boton>
    </div>
  );
}
