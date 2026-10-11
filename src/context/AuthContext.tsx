import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { fetchAppUser, hasSavedPin, type AppUser } from "../services/auth.service";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [pinExists, setPinExists] = useState(hasSavedPin());
  const [pinUnlocked, setPinUnlocked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser && firebaseUser.emailVerified) {
          setAppUser(await fetchAppUser(firebaseUser.uid));
        } else {
          setAppUser(null);
        }
      } catch (e) {
        console.error("No se pudo cargar el perfil del usuario", e);
        setAppUser(null);
      } finally {
        setFirebaseReady(true);
      }
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
