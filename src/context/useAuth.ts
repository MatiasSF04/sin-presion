import { createContext, useContext } from "react";
import type { AppUser } from "../services/auth.service";

export interface AuthContextValue {
  firebaseReady: boolean;      // ya se resolvió el estado inicial de Firebase
  appUser: AppUser | null;     // datos del usuario logueado (null si no hay sesión)
  pinExists: boolean;          // hay un PIN guardado en este dispositivo
  pinUnlocked: boolean;        // el usuario ya ingresó el PIN correctamente en esta sesión de app
  errorPerfil: string | null;  // mensaje si no se pudo cargar el perfil (sin conexión, cuenta sin perfil)
  setAppUser: (user: AppUser | null) => void;
  setPinUnlocked: (value: boolean) => void;
  refreshPinStatus: () => void;
  /** Vuelve a cargar el perfil de la sesión actual. Devuelve el mensaje de error o null. */
  reintentarPerfil: () => Promise<string | null>;
  limpiarErrorPerfil: () => void;
}

// El contexto y su hook viven aparte de AuthProvider para que AuthContext.tsx
// exporte solo componentes (requisito de Fast Refresh de Vite).
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
