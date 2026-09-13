import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserRole = "elder" | "caregiver";

export interface AppUser {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
}

const UID_STORAGE_KEY = "sinpresion_uid";
const PIN_HASH_KEY = "sinpresion_pin_hash";
const PIN_SALT_KEY = "sinpresion_pin_salt";

// --- Login inicial por correo y contraseña ---
export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return fetchAppUser(credential.user.uid);
}

// --- Registro de una cuenta nueva ---
export async function registerWithEmail(
  email: string,
  password: string,
  name: string,
  role: UserRole
): Promise<AppUser> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user);

  const appUser: AppUser = { uid: credential.user.uid, role, name, email };

  await setDoc(doc(db, "users", credential.user.uid), {
    role,
    name,
    email,
    createdAt: Timestamp.now(),
  });

  return appUser;
}

export function isEmailVerified(): boolean {
  return auth.currentUser?.emailVerified ?? false;
}

// --- Consultar el perfil (role, name) desde Firestore ---
export async function fetchAppUser(uid: string): Promise<AppUser> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) {
    throw new Error("Usuario no encontrado en la base de datos");
  }
  const data = snapshot.data();
  return {
    uid,
    role: data.role,
    name: data.name,
    email: data.email,
  };
}

// --- PIN local (solo en este dispositivo), guardado como hash + salt ---
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function savePinForDevice(uid: string, pin: string) {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(UID_STORAGE_KEY, uid);
}

export function hasSavedPin(): boolean {
  return localStorage.getItem(PIN_HASH_KEY) !== null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const savedHash = localStorage.getItem(PIN_HASH_KEY);
  const salt = localStorage.getItem(PIN_SALT_KEY);
  if (!savedHash || !salt) return false;
  const attemptHash = await hashPin(pin, salt);
  return attemptHash === savedHash;
}

export function getSavedUid(): string | null {
  return localStorage.getItem(UID_STORAGE_KEY);
}

export function clearSavedPin() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(UID_STORAGE_KEY);
}

export async function signOut() {
  clearSavedPin();
  await firebaseSignOut(auth);
}