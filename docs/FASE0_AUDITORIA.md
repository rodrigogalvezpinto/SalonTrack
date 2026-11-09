# Fase 0 — Auditoría técnica de SalonTrack v1 y brecha con el Roadmap 2.0

Fecha: 2026-11-09 · Base auditada: commit `31b8b50` (v1.0.0)

## 1. Inventario de lo existente

### Stack
React 19 + TypeScript + Vite 8 + Tailwind 4 (frontend SPA/PWA) · Express 4 + tsx (backend) · JWT + bcryptjs · servidor único en el puerto 3000 (Vite en modo middleware en desarrollo).

### Backend (v1)
| Archivo | Responsabilidad |
|---|---|
| `server.ts` | Arranque, seed demo, monta `/api` y Vite/estáticos |
| `server/db.ts` | Persistencia en `data/salontrack.json` (todo en memoria, reescritura completa en cada cambio) |
| `server/auth.ts` | Hash bcrypt, JWT, `requireAuth`, seed de la cuenta demo |
| `server/routes.ts` | Los 30 endpoints en un único archivo (1.282 líneas) |

### Endpoints v1
`/health` · `auth/{register,login,me,forgot-password,reset-password}` · `profile` (GET/PUT) · `clients` (CRUD + búsqueda/filtros) · `services` (POST/DELETE, historial CRM) · `contact-logs` · `dashboard/stats` · `calendar` · `subscriptions/{plans,current,activate-license}` · `payments/{create-preference,webhook}` · `backup/export` · `re-engagement` (GET, `status`, `template`) · `notifications/{preferences,upcoming,test}`.

### Modelo de datos v1 (JSON)
`users`, `profiles` (mezcla datos personales y del salón), `clients`, `services` (historial de atenciones del CRM), `contact_logs`, `subscriptions`, `payments` (pagos de suscripción).

### Frontend
Vistas: Landing, Auth, Dashboard, Clientas, Ficha de clienta, Retoques, Re-engagement, Calculadora de ingresos, Calendario, Configuración. Componentes: Sidebar/BottomNav/Header, modales de clienta, servicio, WhatsApp y checkout, banner offline, instalación PWA. Navegación por estado interno (sin router).

### Pruebas v1
10 pruebas unitarias en `tests/run-tests.ts`. Varias no ejercitaban el código real (p. ej. el test de aislamiento filtraba un arreglo en memoria; el de licencias solo sumaba días).

## 2. Hallazgos y riesgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| R1 | `npm install` fallaba (conflicto de peer `esbuild@^0.25` vs Vite 8) | Alta | Corregido en Fase 1 |
| R2 | `POST /auth/reset-password` cambiaba la contraseña de cualquier cuenta solo con el correo | Crítica | Corregido: token de un solo uso, hasheado y con expiración |
| R3 | `forgot-password` devolvía `sent: true/false` (enumeración de correos) | Media | Corregido |
| R4 | `activate-license` activa licencias pagadas sin pago real (cualquier `payment_ref`) | Alta | Mitigado: solo con `PAYMENT_PROVIDER=local` (simulación declarada); con Mercado Pago se rechaza. Rediseño completo en Fase 10 |
| R5 | Secreto JWT por defecto también en producción | Alta | Corregido: el servidor no arranca en producción sin `JWT_SECRET` robusto |
| R6 | JSON reescrito completo en cada operación; sin transacciones, FK ni control de concurrencia; un JSON corrupto se reinicializaba vacío (pérdida de datos) | Alta | Corregido con SQLite |
| R7 | Validación de entrada mínima (fechas, montos, estados libres) | Media | Corregido para los endpoints existentes |
| R8 | Sin manejo centralizado de errores ni rate limiting | Media | Corregido |
| R9 | `.env.example` con API keys ficticias (Gemini, Resend, Mercado Pago) | Baja | Corregido |
| R10 | `AuthModal` no cambiaba entre login/registro al reabrirse con otro modo | Baja | Corregido |
| R11 | El "profile" mezcla persona y negocio; no existen negocios, roles ni equipo | — | Fase 2 |
| R12 | La documentación v1 declara integraciones reales (Mercado Pago, webhooks verificados) que solo están simuladas | Media | Documentación corregida; integración real en etapa posterior |

## 3. Brecha con el Roadmap 2.0

| Fase | Estado tras este PR |
|---|---|
| 0 Auditoría y respaldo | ✅ Este documento; respaldo automático del JSON antes de migrar |
| 1 Persistencia y arquitectura | ✅ SQLite, migraciones, repositorios, transacciones, validación/errores centralizados, auth endurecida, adaptadores locales |
| 2 Usuarios, roles y negocios | ⏳ Pendiente |
| 3 Categorías y servicios | ⏳ Pendiente |
| 4 Agenda y disponibilidad | ⏳ Pendiente |
| 5 Marketplace | ⏳ Pendiente |
| 6 Reservas | ⏳ Pendiente |
| 7 Pagos locales | ⏳ Pendiente (existe solo el checkout simulado de suscripciones) |
| 8 Paneles y estadísticas | ⏳ Parcial (dashboard CRM v1) |
| 9 Notificaciones y reputación | ⏳ Parcial (`notification_delivery_logs` + proveedor de email local) |
| 10 Suscripciones | ⏳ Parcial (planes v1) |
| 11 Calidad | ⏳ Continuo |

## 4. Funcionalidades reutilizables
- CRM completo (clientas, historial, contactos, re-engagement, calendario, dashboard): se conserva y será el módulo "Clientes" del portal profesional.
- Formateadores chilenos (`src/utils/formatters.ts`), PWA, notificaciones del navegador.
- Planes y flujo de checkout como base de Fase 10.

## 5. Plan de migración de datos (ejecutado en Fase 1)
1. Al iniciar, si existe `data/salontrack.json` con datos, se copia a `data/backups/salontrack-legacy-<fecha>.json`.
2. Se importan usuarios → perfiles → clientas → historial → contactos → suscripciones → pagos, conservando los IDs.
3. Inserciones `INSERT OR IGNORE` + verificación por ID: re-ejecutar no duplica ni sobrescribe cambios hechos en SQLite.
4. Registros huérfanos o inválidos se omiten y se reportan (`legacy_imports.summary`).
5. El JSON original **no se modifica ni elimina**. Comando manual: `npm run db:import-json [-- archivo] [--force]`.

## 6. Decisiones de nombres para evitar colisiones futuras
- `services` (v1, historial CRM) → tabla `client_service_history`. El nombre `services` queda reservado para el catálogo publicable (Fase 3). La ruta `/api/services` se mantiene por compatibilidad.
- `payments` (v1, pagos de licencia) → `subscription_payments`, separado de los futuros pagos de reservas (Fase 7).
- `profiles` → `user_profiles`. Los datos del salón se moverán a `businesses` en Fase 2.
