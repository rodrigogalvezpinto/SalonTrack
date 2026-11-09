# API.md — Documentación de la API REST de SalonTrack

Todos los endpoints protegidos requieren el encabezado:
```http
Authorization: Bearer <TOKEN_JWT>
```

---

## 1. Autenticación (`/api/auth`)

### `POST /api/auth/register`
Registra una nueva cuenta profesional.
- **Body:** `{ email, password, full_name, business_name, phone }`
- **Respuesta (201):** `{ message, token, user: { id, email, profile, subscription } }`

### `POST /api/auth/login`
Inicia sesión con credenciales.
- **Body:** `{ email, password }`
- **Respuesta (200):** `{ message, token, user }`

### `GET /api/auth/me`
Obtiene los datos del usuario en sesión, perfil y días de licencia activa.

### `POST /api/auth/forgot-password`
Solicitud de recuperación de acceso.

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
Crea una preferencia de pago en Mercado Pago Chile para planes en CLP:
- `basic_monthly` ($9.990 CLP)
- `pro_quarterly` ($14.990 CLP)
- `annual` ($19.990 CLP)

### `POST /api/payments/webhook`
Recibe notificaciones de pago de Mercado Pago, verifica el estado real del cobro en el backend y extiende la licencia automáticamente de forma idempotente.

### `POST /api/subscriptions/activate-license`
Endpoint seguro para activación y extensión de licencias.
