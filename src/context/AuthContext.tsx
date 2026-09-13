import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { fetchAppUser, hasSavedPin, type AppUser } from "../services/auth.service";

interface AuthContextValue {
  firebaseReady: boolean;      // ya se resolvió el estado inicial de Firebase
  appUser: AppUser | null;     // datos del usuario logueado (null si no hay sesión)
  pinExists: boolean;          // hay un PIN guardado en este dispositivo
  pinUnlocked: boolean;        // el usuario ya ingresó el PIN correctamente en esta sesión de app
  setAppUser: (user: AppUser | null) => void;
  setPinUnlocked: (value: boolean) => void;
  refreshPinStatus: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [pinExists, setPinExists] = useState(hasSavedPin());
  const [pinUnlocked, setPinUnlocked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        const user = await fetchAppUser(firebaseUser.uid);
        setAppUser(user);
      } else {
        setAppUser(null);
      }
      setFirebaseReady(true);
    });
    return unsubscribe;
  }, []);

  const refreshPinStatus = () => setPinExists(hasSavedPin());

  return (
    <AuthContext.Provider
      value={{ firebaseReady, appUser, pinExists, pinUnlocked, setAppUser, setPinUnlocked, refreshPinStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}