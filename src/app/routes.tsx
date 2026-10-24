import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { PinUnlockPage } from "../pages/auth/PinUnlockPage";
import { LinkCaregiverPage } from "../pages/auth/LinkCaregiverPage";

import { HomePage } from "../pages/home/HomePage";
import { TasksPage } from "../pages/tasks/TasksPage";
import { VitalsSelectPage } from "../pages/vitals/VitalsSelectPage";
import { VitalsEntryPage } from "../pages/vitals/VitalsEntryPage";
import { SummaryPage } from "../pages/summary/SummaryPage";
import { CalendarPage } from "../pages/calendar/CalendarPage";
import { SettingsPage } from "../pages/settings/SettingsPage";

import { CaregiverHomePage } from "../pages/caregiver/CaregiverHomePage";
import { CaregiverAlertsPage } from "../pages/caregiver/CaregiverAlertsPage";
import { TareasCuidadorPage } from "../pages/caregiver/TareasCuidadorPage";
import { PerfilCuidadorPage } from "../pages/caregiver/PerfilCuidadorPage";
import { MedicionesCuidadorPage } from "../pages/caregiver/MedicionesCuidadorPage";

// [TEMPORAL] - CAMBIAR esto en false antes de la entrega o el pilotaje.
// Mientras esté en true, se salta todo el flujo de login/PIN y entra directo a Home.
const DEV_SKIP_AUTH = false;

export function AppRoutes() {
  const { firebaseReady, appUser, pinExists, pinUnlocked } = useAuth();

  if (DEV_SKIP_AUTH) {
    return (
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/vitals" element={<VitalsSelectPage />} />
        <Route path="/vitals/:type" element={<VitalsEntryPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    );
  }

  if (!firebaseReady) {
    return <div>Cargando...</div>; // TODO: reemplazar por un spinner con la identidad visual
  }

  // Caso 1: no hay sesión de Firebase (nunca inició sesión o cerró sesión)
  if (!appUser) {
    // Si ya existe un PIN guardado en este dispositivo, primero intenta desbloquear con PIN
    if (pinExists && !pinUnlocked) {
      return (
        <Routes>
          <Route path="*" element={<PinUnlockPage />} />
        </Routes>
      );
    }
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Caso 2: hay sesión, pero el PIN de este dispositivo aún no fue creado ni desbloqueado
  if (!pinUnlocked) {
    return (
      <Routes>
        <Route path="*" element={<PinUnlockPage />} />
      </Routes>
    );
  }

  // Caso 3: sesión activa y PIN desbloqueado → rutas según rol
  if (appUser.role === "caregiver") {
    return (
      <Routes>
        <Route path="/caregiver" element={<CaregiverHomePage />} />
        <Route path="/caregiver/alerts" element={<CaregiverAlertsPage />} />
        <Route path="/caregiver/tasks" element={<TareasCuidadorPage />} />
        <Route path="/caregiver/perfil" element={<PerfilCuidadorPage />} />
        <Route path="/caregiver/mediciones" element={<MedicionesCuidadorPage />} />
        <Route path="/link" element={<LinkCaregiverPage />} />
        <Route path="*" element={<Navigate to="/caregiver" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/vitals" element={<VitalsSelectPage />} />
      <Route path="/vitals/:type" element={<VitalsEntryPage />} />
      <Route path="/summary" element={<SummaryPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}