# Estado del proyecto — SalonTrack 2.0

Auditoría de la base `origin/main` (`9a75d5a`) y de los endurecimientos puntuales de esta rama. Los estados reflejan el código disponible, no solo las pantallas.

## Avance por fase

| Fase | Estado | Evidencia |
|---|---|---|
| 0 — Auditoría y protección | Parcial | `.gitignore`, `SECURITY.md` y `docs/ROADMAP_2.0_PROMPT.md` documentan protección y alcance; falta automatizar una restauración verificable de respaldos. |
| 1 — Persistencia y arquitectura | Parcial | El CRM y las suscripciones usan repositorios SQLite; las escrituras multi-tabla requeridas son transaccionales. Siguen pendientes checksums de migraciones y pruebas de restauración de respaldos. |
| 2 — Usuarios, roles y negocios | Parcial | `user_roles`, `business_members` y las rutas `/api/business/*` existen; falta middleware central que verifique permisos por negocio. |
| 3 — Categorías y servicios | Parcial | Hay catálogo inicial, `/api/marketplace/categories` y CRUD de servicios en `/api/business/:id/services`; la administración completa de categorías sigue pendiente. |
| 4 — Agenda y disponibilidad | Parcial | `server/availability.ts` y `/api/availability/slots` consideran jornada, personal, reservas y bloqueos; no hay garantía transaccional frente a solicitudes simultáneas. |
| 5 — Marketplace | Hecho | `MarketplaceView.tsx`, `/api/marketplace/search`, `/api/marketplace/business/:slug` y favoritos cubren búsqueda, filtros, ordenamiento, mapa local y perfiles públicos. |
| 6 — Reservas | Parcial | `/api/bookings` y sus acciones de confirmar, rechazar, cancelar y completar existen; faltan reprogramación y expiración automatizada. |
| 7 — Pagos locales | Parcial | Hay checkout y activación simulados; `/api/payments/webhook` solo confirma recepción y no valida una operación externa. |
| 8 — Paneles y estadísticas | Parcial | `/api/dashboard/stats`, `/api/admin/dashboard` y `CustomerPortalView.tsx` entregan paneles básicos con datos consultados directamente de SQLite. |
| 9 — Notificaciones y reputación | Parcial | Existen tablas y rutas de notificaciones/reseñas y adaptadores locales de WhatsApp/email; no hay entrega real ni procesamiento programado completo. |
| 10 — Suscripciones y monetización | Parcial | `/api/subscriptions/plans`, `/api/subscriptions/activate-license` y `subscriptions` implementan planes y activación simulada; faltan límites de plan aplicados de forma consistente en backend. |
| 11 — Calidad y estabilización | Parcial | `tests/run-tests.ts` cubre utilidades, disponibilidad y flujos API puntuales; faltan pruebas E2E, concurrencia, accesibilidad y autorización integral. |

## Decisión sobre las implementaciones alternativas

Los PR #1 y #2 contenían una implementación alternativa. Se decidió cerrarlos al continuar desde `origin/main`; no se portó su arquitectura. Siguen pendientes ideas valiosas de esa alternativa:

- Migraciones versionadas con checksums y verificación de integridad.
- Middleware central de permisos por negocio y pruebas de aislamiento entre negocios.
- Completar las pruebas de restauración de respaldos y recuperación ante fallos.
- Pruebas de concurrencia, flujos end-to-end y recuperación ante fallos.

## Riesgos conocidos

- Las rutas CRM ya usan SQLite directamente y agrupan las escrituras multi-tabla en transacciones; la estrategia de restauración de respaldos y la verificación con checksums siguen pendientes.
- `schema_migrations` registra versiones sin checksums, estrategia de rollback ni verificación automática de una migración ya aplicada.
- La autorización por negocio no está centralizada. `requireAuth` protege varias rutas, pero la validación de membresía/propiedad depende de cada endpoint.
- La recuperación usa un adaptador local que no entrega correo real. Fuera de producción, cada correo (incluido el enlace de recuperación) se guarda en `data/dev-mail/outbox.jsonl`, ignorado por git; la consola solo indica el destinatario. En producción no se guarda el cuerpo: debe integrarse una entrega real antes de habilitar la recuperación.
- El checkout y el webhook son simulados; no se verifican firmas de proveedor ni se debe tratar la respuesta actual como confirmación real de pago.
- La disponibilidad consulta reservas antes de insertar, sin una garantía atómica contra dos reservas concurrentes.

## Próximos pasos prioritarios

1. **P0 — Persistencia:** CRM y suscripciones migrados a repositorios SQLite con transacciones. Completar checksums de migraciones y pruebas automatizadas de respaldo/restauración.
2. **P0 — Autorización:** implementar middleware de pertenencia y permisos por negocio, aplicarlo a todas las rutas de negocio/reservas y añadir pruebas negativas entre cuentas.
3. **P1 — Migraciones y respaldo:** añadir checksums, validación de versiones, estrategia de recuperación y una prueba automatizada de respaldo/restauración.
4. **P1 — Reservas:** hacer atómica la comprobación e inserción de turnos; completar reprogramación, expiración e integración transaccional con CRM.
5. **P2 — Servicios externos:** reemplazar la simulación de email y pagos e implementar validación de firmas de webhook.
6. **P2 — Estabilización:** ampliar pruebas E2E, de concurrencia y accesibilidad; cubrir límites de suscripción y validación de permisos en CI.
