import { useCallback, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "../services/firebase";
import { fetchAppUser, hasSavedPin, type AppUser } from "../services/auth.service";
import { conTiempoLimite, ErrorPerfilInexistente, mensajeErrorAcceso } from "../services/auth.logic";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [pinExists, setPinExists] = useState(hasSavedPin());
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  /**
   * Carga el perfil (rol y nombre) de la sesión actual, con tiempo límite.
   * Devuelve el mensaje de error para mostrar, o null si todo salió bien.
   * Una cuenta sin perfil en users se cierra: no puede usar la app.
   */
  const cargarPerfil = useCallback(async (firebaseUser: User | null): Promise<string | null> => {
    try {
      if (!firebaseUser || !firebaseUser.emailVerified) {
        setAppUser(null); // el error anterior se conserva para que el login lo muestre
        return null;
      }
      setAppUser(await conTiempoLimite(fetchAppUser(firebaseUser.uid)));
      setErrorPerfil(null);
      return null;
    } catch (e) {
      console.error("No se pudo cargar el perfil del usuario", e);
      setAppUser(null);
      if (e instanceof ErrorPerfilInexistente) await firebaseSignOut(auth).catch(() => {});
      const mensaje = mensajeErrorAcceso(e, "login");
      setErrorPerfil(mensaje);
      return mensaje;
    } finally {
      setFirebaseReady(true);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => void cargarPerfil(u)), [cargarPerfil]);

  const reintentarPerfil = useCallback(() => cargarPerfil(auth.currentUser), [cargarPerfil]);
  const limpiarErrorPerfil = useCallback(() => setErrorPerfil(null), []);
  const refreshPinStatus = () => setPinExists(hasSavedPin());

  return (
    <AuthContext.Provider
      value={{
        firebaseReady, appUser, pinExists, pinUnlocked, errorPerfil,
        setAppUser, setPinUnlocked, refreshPinStatus, reintentarPerfil, limpiarErrorPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
