# SIN-PRESIÓN

Agenda clínica digital para adultos mayores y su cuidador: tareas y recordatorios
de medicamentos, registro de signos vitales con rangos por persona, botón SOS y un
panel del cuidador para seguir el cumplimiento.

Proyecto de título — Ingeniería en Computación e Informática, Universidad Andrés Bello.

## Tecnologías

- React + TypeScript + Vite, estilos con CSS Modules
- Firebase: Authentication, Cloud Firestore y Hosting
- Capacitor (Android) para notificaciones locales y la APK

## Requisitos

- Node.js 24 o superior
- Firebase CLI (`npm i -g firebase-tools`) para desplegar
- Archivo `.env` en la raíz con las variables `VITE_FIREBASE_*` (no se versiona)

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas automáticas (Vitest) |
| `npm run lint` | Revisión de estilo (ESLint) |
| `npm run build` | Compila a `dist/` |
| `firebase deploy --only hosting` | Publica la app web |
| `firebase deploy --only firestore:rules,firestore:indexes` | Publica reglas e índices |

## Estructura

- `src/pages` — pantallas (adulto mayor, cuidador, acceso)
- `src/components` — componentes reutilizables
- `src/services` — acceso a Firebase (`*.service.ts`) y lógica pura probada (`*.logic.ts`)
- `src/hooks` — suscripciones en vivo a Firestore
- `src/estilos` — tokens y estilos base
- `firestore.rules` — reglas de acceso por rol
