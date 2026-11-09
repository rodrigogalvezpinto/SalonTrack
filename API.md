# API.md — Documentación de la API REST de SalonTrack

Todos los endpoints protegidos requieren el encabezado:
```http
Authorization: Bearer <TOKEN_JWT>
```

---

## 1. Autenticación (`/api/auth`)

### `POST /api/auth/register`
Registra una cuenta profesional o cliente. `account_type` acepta `professional` (predeterminado, con negocio inicial y prueba de 14 días) o `customer` (sin suscripción). Responde **409** si el correo ya existe.
- **Body:** `{ email, password, full_name, business_name?, phone?, account_type? }`
- **Respuesta (201):** `{ message, token, user: { id, email, profile, subscription?, roles, memberships } }`

### `POST /api/auth/login`
Inicia sesión con credenciales.
- **Body:** `{ email, password }`
- **Respuesta (200):** `{ message, token, user }`

### `GET /api/auth/me`
Obtiene los datos del usuario en sesión, perfil y días de licencia activa.

### `POST /api/auth/forgot-password`
Solicitud de recuperación de acceso.
- **Body:** `{ email }`
- **Respuesta (200):** siempre el mismo mensaje genérico (no revela si el correo existe). Si existe, se envía un enlace `/?reset_token=…` mediante el proveedor de email (en local: consola + `notification_delivery_logs`).

### `POST /api/auth/reset-password`
- **Body:** `{ token, new_password }` — el token es de un solo uso y expira en 30 minutos.

### Errores
Todas las respuestas de error tienen la forma `{ error: string, code: string }`. Códigos HTTP: 400 validación, 401 no autenticado, 403 sin permiso, 404 no encontrado (también para recursos de otro usuario), 409 conflicto/duplicado, 429 demasiados intentos, 500 error interno.

---

## 2. Gestión de Clientas (`/api/clients`)

### `GET /api/clients`
Lista clientas del usuario con filtros y búsqueda.
- **Query params:**
  - `search`: Texto para buscar por nombre o teléfono (+56 9...).
  - `filter`: `all`, `upcoming`, `overdue`, `contacted`, `pending_contact`.
- **Respuesta (200):** `{ clients: Client[], total: number, santiago_date: string }`

### `POST /api/clients`
Crea una clienta y opcionalmente su servicio inicial.
- **Body:**
  ```json
  {
    "full_name": "Daniela Rojas",
    "phone": "+56973456789",
    "notes": "Pelo fino, usar plex",
    "initial_service": {
      "service_type": "Babylights",
      "color_formula": "Blondor + 20vol + Matiz 9/16",
      "amount_clp": 68000,
      "service_date": "2026-11-07",
      "recommended_interval_days": 30
    }
  }
  ```

### `GET /api/clients/:id`
Ficha completa con historial 1-a-N de servicios y registro de contactos.

### `PUT /api/clients/:id`
Modifica nombre, teléfono y observaciones de la clienta.

### `DELETE /api/clients/:id`
Elimina la clienta y sus registros asociados en cascada.

---

## 3. Historial de Servicios (`/api/services`)

### `POST /api/services`
Registra una nueva visita o servicio completado.
- **Body:** `{ client_id, service_type, color_formula, tint_brand, service_date, amount_clp, recommended_interval_days, notes }`
- **Respuesta (201):** Calcula automáticamente `next_retouch_date`.

### `DELETE /api/services/:id`
Elimina un servicio específico del historial.

---

## 4. Trazabilidad WhatsApp (`/api/contact-logs`)

### `POST /api/contact-logs`
Registra que se inició un contacto hacia una clienta.
- **Body:** `{ client_id, status: 'contacted' | 'scheduled', notes }`

---

## 5. Módulo de Re-engagement (`/api/re-engagement`)

### `GET /api/re-engagement`
Identifica clientas sin visitas por un período igual o superior al umbral configurado.
- **Query param:** `threshold_days` (ej. 60, 90, 180 días).
- **Respuesta (200):**
  ```json
  {
    "threshold_days": 90,
    "total_inactive_clients": 2,
    "recontacted_count": 1,
    "reactivated_count": 0,
    "potential_recoverable_revenue_clp": 112000,
    "template": "...",
    "candidates": [...]
  }
  ```

### `POST /api/re-engagement/status`
Actualiza el estado de una clienta inactiva.
- **Body:** `{ client_id, status: 'recontacted' | 'reactivated' | 'dismissed', notes }`

### `PUT /api/re-engagement/template`
Actualiza la plantilla de oferta comercial y el umbral predeterminado.

---

## 6. Notificaciones Push (`/api/notifications`)

### `GET /api/notifications/preferences`
Devuelve las preferencias de alerta y hora para la zona horaria `America/Santiago`.

### `PUT /api/notifications/preferences`
Guarda el estado de activación, hora de recordatorio (ej: `"09:00"`) y anticipación de días.

### `GET /api/notifications/upcoming`
Devuelve las alertas del día de hoy y de la semana.

### `POST /api/notifications/test`
Envía o simula una notificación push de verificación.

---

## 7. Pagos y Mercado Pago (`/api/payments`)

### `POST /api/payments/create-preference`
Crea un checkout con el proveedor configurado (`PAYMENT_PROVIDER`). Con `local` (por defecto) responde `mode: "local_simulation"` y no hay cobro real; con `mercadopago` responde `mode: "mercadopago_live"` e `init_point`. Planes en CLP (el precio siempre se toma del backend):
- `basic_monthly` ($9.990 CLP)
- `pro_quarterly` ($14.990 CLP)
- `annual` ($19.990 CLP)

### `POST /api/payments/webhook`
Recibe notificaciones de Mercado Pago de forma idempotente. La verificación del cobro contra la API de Mercado Pago se implementará al activar la integración real.

### `POST /api/subscriptions/activate-license`
Confirma el pago simulado y extiende la licencia. Solo disponible con `PAYMENT_PROVIDER=local` (403 en otro caso). Idempotente por `payment_ref`: repetir la referencia no duplica pagos; usar una referencia de otro usuario responde 409.

## 8. Negocios, equipo y roles

La sesión de `/auth/login`, `/auth/register` y `/auth/me` incluye `roles` y las `memberships` activas. Los negocios son privados por defecto y solo se publican al completar los requisitos del perfil.

| Método y ruta | Acceso |
|---|---|
| `GET /api/businesses/mine` | Autenticado |
| `POST /api/businesses` | Autenticado; crea un negocio borrador y otorga `PROFESSIONAL` |
| `GET /api/businesses/:businessId` | Integrante activo |
| `PATCH /api/businesses/:businessId` | `OWNER`, `ADMIN` |
| `POST /api/businesses/:businessId/status` | `OWNER`, `ADMIN` (reglas de transición aplican) |
| `GET /api/businesses/:businessId/members` | Integrante activo |
| `POST /api/businesses/:businessId/members` | `OWNER`, `ADMIN` |
| `PATCH /api/businesses/:businessId/members/:memberId` | `OWNER`, `ADMIN` |
| `GET /api/public/businesses` | Público; solo publicados |
| `GET /api/public/businesses/:slug` | Público; solo publicados |

Permisos por rol de negocio:

| Permiso | OWNER | ADMIN | PROFESSIONAL | RECEPTION |
|---|:---:|:---:|:---:|:---:|
| Ver negocio y equipo | Sí | Sí | Sí | Sí |
| Editar negocio y administrar integrantes | Sí | Sí | No | No |
| Cambiar estado de publicación | Sí | Sí | No | No |

La API `PATCH` de negocio valida URLs `http(s)`, correo, rangos geográficos y requisitos de publicación; el estado solo cambia mediante `/status`. Un ADMIN solo puede administrar integrantes con rol `PROFESSIONAL` o `RECEPTION`. Las acciones de plataforma requieren `PLATFORM_ADMIN`.

## 9. Administración de plataforma

Todas las rutas de `/api/admin/*` requieren autenticación y `PLATFORM_ADMIN`.

- `GET /api/admin/users`: cuentas y roles; nunca devuelve hashes de contraseñas.
- `GET /api/admin/businesses?status=`: negocios y correo de propietario.
- `POST /api/admin/businesses/:businessId/status`: aprobar, rechazar, suspender o reactivar según la máquina de estados; rechazo y suspensión requieren motivo.
- `GET /api/admin/settings` y `PUT /api/admin/settings`: consulta y cambia `business_publication_requires_review`.
- `npm run admin:grant -- <correo>` asigna el rol `PLATFORM_ADMIN` a una cuenta existente.
