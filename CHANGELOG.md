# CHANGELOG.md — Registro de Versiones de SalonTrack

## [2.0.0-alpha.2] - 2026-11-09 — Fase 2: Usuarios, roles y negocios

### Añadido
- Migración `002_roles_businesses.sql` con roles de plataforma, negocios, membresías de equipo y configuración.
- Registro diferenciado de clientes y profesionales, permisos por rol y administración de plataforma.
- Perfiles públicos de negocios publicados, panel profesional y panel administrativo.
- Cuentas demo de cliente, administración, propietario y trabajador; comando `admin:grant`.
- Endpoints privados de negocio/equipo y perfiles públicos con protección de dirección exacta.

### Seguridad
- CRM limitado a usuarios con rol profesional; negocios privados responden 404 a usuarios sin membresía activa.
- Los datos públicos usan una lista permitida y omiten identificadores personales y metadatos administrativos.

## [2.0.0-alpha.1] - 2026-11-09 — Roadmap 2.0, Fases 0 y 1

### Añadido
- Auditoría técnica v1 y brecha con el roadmap 2.0 (`docs/FASE0_AUDITORIA.md`).
- Persistencia SQLite (`better-sqlite3`) con migraciones versionadas y verificadas por checksum, claves foráneas, índices, restricciones CHECK y WAL.
- Capa de repositorios y rutas separadas por dominio; `createApp()` reutilizable en pruebas.
- Importación idempotente del JSON v1 con respaldo previo y reporte de verificación (`legacy_imports`).
- Comandos `db:migrate`, `db:seed`, `db:reset`, `db:backup`, `db:restore`, `db:import-json`.
- Adaptadores de proveedores (pagos, email, WhatsApp) con implementaciones locales; registro de envíos en `notification_delivery_logs`.
- Auditoría de operaciones críticas (`audit_logs`), manejo centralizado de errores, validación de entrada y rate limiting en autenticación.
- 35 pruebas unitarias y de integración.

### Cambiado
- El historial de atenciones del CRM se almacena en `client_service_history` y los pagos de licencias en `subscription_payments` (las rutas `/api/*` mantienen su contrato).
- El registro con correo duplicado responde 409.
- El checkout local se identifica como `mode: "local_simulation"`.

### Seguridad
- `reset-password` exige un token de un solo uso (hasheado, 30 min) enviado por el proveedor de email; `forgot-password` ya no revela si el correo existe.
- En producción el servidor exige `JWT_SECRET` robusto.
- `activate-license` solo funciona con el proveedor de pagos local.

### Corregido
- `npm install` fallaba por conflicto de dependencias con esbuild.
- El modal de autenticación no cambiaba de modo al reabrirse.


## [1.0.0] - 2026-11-08

### Añadido
- **Fase 1 — Fundación:**
  - Servidor Express unificado con Vite middleware.
  - Autenticación segura con JWT y `bcryptjs`.
  - Aislamiento multi-tenant por usuario en todas las consultas.
  - Modelo de datos relacional para clientas, fórmulas, servicios e historial.
- **Fase 2 — Producto Piloto:**
  - Dashboard interactivo con indicadores clave (Total de clientas, retoques de la semana, ingresos potenciales en CLP, pendientes de contacto).
  - Aclaración contable obligatoria sobre ingresos potenciales vs ingresos efectivamente cobrados.
  - Gestión integral de clientas (alta, edición, baja, búsqueda por nombre y teléfono chileno +56 9).
  - Historial de servicios 1-a-N con registro de fórmulas de tinte y cálculo automático de retoques.
  - Integración directa con WhatsApp (enlace `wa.me` precompletado con registro de trazabilidad).
- **Fase 3 — Re-engagement & Notificaciones:**
  - Módulo de Re-engagement para detectar clientas inactivas hace 2, 3 o 6 meses.
  - Plantilla de WhatsApp con ofertas y descuentos de incentivo.
  - Estados de seguimiento: *Pendiente*, *Recontactada*, *Reactivada*, *Descartada*.
  - Notificaciones Push matutinas con soporte de zona horaria `America/Santiago`, anticipación configurable y alerta sonora.
  - Calendario mensual y semanal con inspección de eventos y retoques del día.
- **Fase 4 — Comercialización:**
  - Landing page de venta orientada a la conversión en Chile.
  - Calculadora interactiva de dinero recuperable en CLP.
  - Integración con Mercado Pago Chile para planes de $9.990, $14.990 y $19.990 CLP.
  - Webhooks con verificación backend e idempotencia.
  - Progressive Web App (PWA) con manifest, iconos 192/512 y botón de instalación con soporte para iOS Safari.
- **Fase 5 — Calidad:**
  - Suite de pruebas automatizadas con 10 tests aprobados (`npm test`).
  - Documentación técnica exhaustiva (README, ARCHITECTURE, DATABASE, API, SECURITY, TESTING, DEPLOYMENT, CHANGELOG, ROADMAP).
