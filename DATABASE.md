# DATABASE.md — Modelo y Esquema de Datos

El diseño de datos de SalonTrack replica una estructura relacional normalizada, diseñada para ser completamente portable a PostgreSQL / Supabase o SQLite.

---

## 1. Esquema de Tablas

### `users`
Almacena las credenciales de acceso de cada profesional.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador único del usuario (`usr_...`) |
| `email` | VARCHAR(255) UNIQUE | Correo electrónico de acceso |
| `password_hash` | VARCHAR(255) | Hash seguro generado con `bcryptjs` (salt 10) |
| `created_at` | TIMESTAMPTZ | Fecha y hora de registro |

### `profiles`
Configuraciones y datos del estudio o salón.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador del perfil (`prof_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Dueño de la cuenta |
| `full_name` | VARCHAR(255) | Nombre de la estilista o profesional |
| `business_name` | VARCHAR(255) | Nombre comercial del salón |
| `phone` | VARCHAR(30) | Teléfono WhatsApp del salón (+56 9 ...) |
| `country` | VARCHAR(20) | Predeterminado: `'Chile'` |
| `currency` | VARCHAR(10) | Predeterminado: `'CLP'` |
| `timezone` | VARCHAR(50) | Predeterminado: `'America/Santiago'` |
| `default_interval_days` | INTEGER | Días recomendados por defecto (30) |
| `whatsapp_template` | TEXT | Mensaje habitual de recordatorio |
| `re_engagement_template`| TEXT | Mensaje de oferta para clientas inactivas |
| `re_engagement_days_threshold`| INTEGER | Umbral de inactividad en días (60, 90, 180) |
| `notification_preferences` | JSONB | Preferencias de push, hora y sonido |

### `clients`
Clientas registradas en el salón.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador único (`cli_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Estilista propietaria del registro |
| `full_name` | VARCHAR(255) | Nombre completo de la clienta |
| `phone` | VARCHAR(30) | Teléfono móvil chileno (+56 9 ...) |
| `notes` | TEXT | Observaciones, alergias o preferencias |
| `re_engagement_status` | VARCHAR(30) | `none`, `recontacted`, `reactivated`, `dismissed` |
| `created_at` | TIMESTAMPTZ | Fecha de creación del registro |
| `updated_at` | TIMESTAMPTZ | Última modificación |

### `services`
Historial de tratamientos y visitas (Relación 1 a N con `clients`).
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador del servicio (`srv_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Aislamiento de cuenta |
| `client_id` | VARCHAR(36) FK -> clients.id | Clienta atendida |
| `service_type` | VARCHAR(100) | Tintura Raíz, Balayage, Babylights, etc. |
| `color_formula` | TEXT | Mezcla técnica (ej: 7.1 + 7.0 + Ox 20vol) |
| `tint_brand` | VARCHAR(100) | L'Oréal, Wella, Schwarzkopf, etc. |
| `service_date` | DATE (YYYY-MM-DD) | Fecha de realización del servicio |
| `amount_clp` | INTEGER | Monto cobrado en CLP (entero, sin decimales) |
| `recommended_interval_days`| INTEGER | Días hasta el próximo retoque (20 a 90) |
| `next_retouch_date` | DATE (YYYY-MM-DD) | Fecha calculada automáticamente |
| `notes` | TEXT | Notas del resultado |

### `contact_logs`
Trazabilidad de contactos realizados a la clienta.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador (`log_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Estilista |
| `client_id` | VARCHAR(36) FK -> clients.id | Clienta contactada |
| `contact_date` | TIMESTAMPTZ | Fecha y hora exacta del contacto |
| `channel` | VARCHAR(20) | `'whatsapp'` |
| `status` | VARCHAR(30) | `'contacted'`, `'scheduled'`, `'no_reply'` |
| `notes` | TEXT | Detalle del mensaje u oferta enviada |

### `subscriptions`
Estado de licencia de uso de la aplicación.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador (`sub_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Usuario suscriptor |
| `plan` | VARCHAR(50) | `basic_monthly`, `pro_quarterly`, `annual` |
| `status` | VARCHAR(20) | `trial`, `active`, `expired`, `pending` |
| `start_date` | TIMESTAMPTZ | Inicio de la licencia |
| `expiration_date` | TIMESTAMPTZ | Fecha de vencimiento |
| `payment_provider` | VARCHAR(50) | `'mercadopago'` |

### `payments`
Registro inmutable de transacciones recibidas.
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(36) PK | Identificador de pago (`pay_...`) |
| `user_id` | VARCHAR(36) FK -> users.id | Usuario |
| `amount_clp` | INTEGER | Importe pagado en CLP |
| `currency` | VARCHAR(10) | `'CLP'` |
| `provider` | VARCHAR(50) | `'mercadopago'` |
| `provider_payment_id` | VARCHAR(100) UNIQUE | Identificador de Mercado Pago (Idempotencia) |
| `status` | VARCHAR(30) | `'approved'`, `'pending'`, `'rejected'` |
| `plan` | VARCHAR(50) | Plan adquirido |
| `created_at` | TIMESTAMPTZ | Fecha y hora de confirmación |

---

## 2. Reglas de Negocio en la Base de Datos

1. **Valores Monetarios en CLP:** Se almacenan exclusivamente como números enteros (`INTEGER`). No se utilizan flotantes para evitar errores de redondeo.
2. **Cascada de Eliminación:** Al borrar una clienta, se eliminan todos sus registros en `services` y `contact_logs`.
3. **No Sobrescritura de Fórmulas:** Cada visita genera un nuevo registro en `services`, conservando el historial técnico completo de coloración.
