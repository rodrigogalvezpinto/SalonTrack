# ARCHITECTURE.md — Arquitectura Técnica de SalonTrack

## 1. Visión General del Sistema

SalonTrack está construido como una aplicación full-stack moderna y desacoplada pero unificada bajo un único servidor Node.js/Express en el puerto 3000, sirviendo la SPA React en producción y mediante Vite middleware en desarrollo.

```
┌─────────────────────────────────────────────────────────────┐
│                       Cliente Web / PWA                     │
│  - React 19 + TypeScript + Tailwind CSS                     │
│  - PWA Service Worker (pwa-192, pwa-512, manifest.json)     │
│  - Web Push Notification Client & Audio Chime               │
│  - React Context (AuthContext) & Local Storage Token        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    Servidor Full-Stack                      │
│                    Node.js + Express                        │
│                                                             │
│  ├── /api/auth          -> Registro, Login, Reset Password  │
│  ├── /api/clients       -> Gestión de Clientas (RLS)        │
│  ├── /api/services      -> Historial 1-a-N de Tratamientos  │
│  ├── /api/contact-logs  -> Trazabilidad de WhatsApp         │
│  ├── /api/dashboard     -> Métricas e Ingresos Potenciales  │
│  ├── /api/re-engagement -> Inactivas, Ofertas y Retención   │
│  ├── /api/notifications -> Alertas Push & Timezone Chile    │
│  ├── /api/calendar      -> Visitas y Retoques Mensual       │
│  └── /api/payments      -> Mercado Pago Chile & Webhooks    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              Capa de Persistencia & Seguridad                │
│  - Motor Atómico con Escritura Transaccional (.tmp -> rename)│
│  - Esquema Relacional Tipado (users, profiles, services...) │
│  - Hashing Bcrypt + Firma JWT 256-bit                       │
│  - Aislamiento Multi-Tenant (User ID verificado en JWT)     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Aislamiento Multi-Tenant (Equivalente RLS)

Ninguna consulta a la base de datos confía en un `user_id` enviado en el cuerpo de la petición.
- El middleware `requireAuth` extrae el `Bearer Token` de los encabezados HTTP.
- Verifica la firma criptográfica con `JWT_SECRET`.
- Inyecta `req.userId` en el objeto de la petición.
- Todos los métodos de consulta filtran obligatoriamente por `req.userId`:
  ```typescript
  const userClients = db.clients.filter(c => c.user_id === req.userId);
  ```

## 3. Flujo Comercial con Mercado Pago Chile

1. **Creación de Preferencia:** El frontend solicita crear una orden para el plan seleccionado ($9.990, $14.990 o $19.990 CLP).
2. **Backend Gateway:** El backend genera la preferencia en Mercado Pago con `notification_url` hacia `/api/payments/webhook`.
3. **Webhook de Confirmación:**
   - Mercado Pago notifica el ID del pago.
   - El backend consulta el estado real en la API de Mercado Pago.
   - **Idempotencia:** Se verifica que el `provider_payment_id` no exista previamente en la tabla `payments`.
   - Se extiende la vigencia de la suscripción (`subscriptions.expiration_date`).
   - Se envía respuesta `200 OK` a Mercado Pago.
4. **Modo Sandbox / Pruebas:** Permite activar licencias de test de forma segura para validación QA sin requerir tarjetas bancarias reales en etapas de homologación.

## 4. Módulo de Re-engagement

- **Lógica de cálculo:** Compara la fecha de la última visita registrada en `services` con la fecha actual en `America/Santiago`.
- **Días de inactividad:** Si `(today - last_visit) >= threshold_days` (ej. 90 días), la clienta se clasifica como candidata.
- **Trazabilidad de estados:**
  - `none`: Inactiva detectada sin acción previa.
  - `recontacted`: Oferta enviada vía WhatsApp.
  - `reactivated`: Clienta agendó y volvió al salón.
  - `dismissed`: Descartada temporalmente por la profesional.

## 5. Notificaciones Push en PWA

- **Compatibilidad:** Implementa la Web Notification API del navegador.
- **Gestión de Permisos:** Manejo explícito con fallback descriptivo para Safari en iOS.
- **Sincronización:** Consulta periódica de alertas del día configuradas según la zona horaria `America/Santiago`.
