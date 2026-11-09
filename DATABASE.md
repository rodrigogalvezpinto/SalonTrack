# DATABASE.md — Modelo y Esquema de Datos

SalonTrack usa **SQLite** (`better-sqlite3`) como base de datos local persistente en `DATABASE_FILE` (por defecto `data/salontrack.sqlite`).

## Convenciones (portables a PostgreSQL)
- IDs `TEXT` con prefijo + UUID (`usr_…`, `cli_…`, `srv_…`).
- Fechas ISO-8601 en `TEXT` (`YYYY-MM-DD` para fechas calendario, timestamp UTC para instantes).
- Montos CLP como `INTEGER` sin decimales.
- JSON en columnas `TEXT` con `CHECK (json_valid(...))`.
- Todo el SQL vive en `server/repositories/` y `server/db/`; las rutas no conocen el motor.

## Migraciones
- Archivos `server/db/migrations/NNN_nombre.sql`, aplicados en orden y de forma atómica al iniciar el servidor o con `npm run db:migrate`.
- Se registran en `schema_migrations` con checksum: una migración ya aplicada **no debe editarse**; crea una nueva.

## Tablas (migraciones 001 y 002)

| Tabla | Descripción | Claves / restricciones |
|---|---|---|
| `users` | Credenciales | `email` único (case-insensitive); `is_demo` separa datos demo |
| `user_profiles` | Perfil y preferencias del profesional (v1 `profiles`) | 1:1 con `users`, `ON DELETE CASCADE` |
| `clients` | Clientas del CRM | FK `user_id`; `re_engagement_status` con CHECK |
| `client_service_history` | Atenciones realizadas (v1 `services`) | FK compuesta `(client_id, user_id)` → `clients`: imposible asociar historial a clientas de otro profesional |
| `contact_logs` | Trazabilidad de contactos | FK compuesta `(client_id, user_id)`; `channel`/`status` con CHECK |
| `subscriptions` | Licencia de SalonTrack | 1 por usuario |
| `subscription_payments` | Pagos de licencias (v1 `payments`) | único `(provider, provider_payment_id)` → idempotencia |
| `password_reset_tokens` | Tokens de recuperación (hash SHA-256, expiración, un solo uso) | FK `user_id` |
| `notification_delivery_logs` | Envíos de email/WhatsApp (simulados o reales) | FK `user_id` `ON DELETE SET NULL` |
| `audit_logs` | Trazabilidad de operaciones críticas | — |
| `legacy_imports` | Importaciones del JSON v1 (archivo, sha256, respaldo, resumen) | — |
| `user_roles` | Roles de plataforma (`CUSTOMER`, `PROFESSIONAL`, `PLATFORM_ADMIN`) | PK compuesta `(user_id, role)` |
| `businesses` | Perfiles de negocio, ubicación, atención y publicación | `slug` único; estados controlados; JSON validado |
| `business_members` | Equipo y permisos dentro de cada negocio | único `(business_id, user_id)`; al menos un propietario activo |
| `platform_settings` | Configuración de plataforma en JSON | clave primaria `key` |

## Reglas de negocio en la base
1. Borrar una clienta elimina en cascada su historial y contactos.
2. Borrar un usuario elimina en cascada todos sus datos.
3. Cada visita genera un registro nuevo en `client_service_history` (no se sobrescriben fórmulas).
4. Montos negativos, estados desconocidos y JSON inválido son rechazados por restricciones CHECK.
5. Cada perfil profesional se representa en un negocio independiente con membresía `OWNER`; los datos CRM siguen aislados por `user_id`.

## Respaldo y restauración
- `npm run db:backup` usa la API de backup en caliente de SQLite.
- `npm run db:restore -- <archivo>` verifica `integrity_check` y `schema_migrations`, guarda una copia `pre-restore-*` de la base actual y reemplaza el archivo (ejecutar con el servidor detenido).

## Migración desde JSON v1
Ver `docs/FASE0_AUDITORIA.md` §5.
