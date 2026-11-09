# CHANGELOG.md — Registro de Versiones de SalonTrack

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
