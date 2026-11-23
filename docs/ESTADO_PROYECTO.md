# Estado del proyecto — SalonTrack 2.0

Auditoría de la base `origin/main` (`9a75d5a`) y de los endurecimientos puntuales de esta rama. Los estados reflejan el código disponible, no solo las pantallas.

## Avance por fase

| Fase | Estado | Evidencia |
|---|---|---|
| 0 — Auditoría y protección | Hecho | `.gitignore`, `SECURITY.md` y `docs/ROADMAP_2.0_PROMPT.md` documentan protección y alcance; los respaldos SQLite se verifican y la restauración crea un respaldo de seguridad previo. |
| 1 — Persistencia y arquitectura | Hecho | El CRM y las suscripciones usan repositorios SQLite; las escrituras multi-tabla requeridas son transaccionales; las migraciones validan checksums SHA-256 y se prueban respaldo/restauración. |
| 2 — Usuarios, roles y negocios | Parcial | `user_roles`, `business_members` y `authorizeBusiness` controlan rutas de negocio; `tests/run-tests.ts` cubre cruces entre cuentas/negocios, roles, membresías desactivadas y aislamiento CRM en los flujos principales. |
| 3 — Categorías y servicios | Parcial | Hay catálogo inicial, `/api/marketplace/categories` y CRUD de servicios en `/api/business/:id/services`; la administración completa de categorías sigue pendiente. |
| 4 — Agenda y disponibilidad | Parcial | `server/availability.ts` y `/api/availability/slots` consideran jornada, personal, pausas, reservas y bloqueos; `POST /api/bookings` exige un horario publicado y libre. Sigue pendiente reforzar la concurrencia de solicitudes simultáneas. |
| 5 — Marketplace | Hecho | `MarketplaceView.tsx`, `/api/marketplace/search`, `/api/marketplace/business/:slug` y favoritos cubren búsqueda, filtros, ordenamiento, mapa local y perfiles públicos. |
| 6 — Reservas | Parcial | `/api/bookings` valida disponibilidad y su creación es transaccional; la reprogramación es autorizada y las finalizaciones escriben en el CRM del dueño con coincidencia telefónica normalizada. Las pruebas cubren creación y reprogramación simultáneas; falta concurrencia multi-proceso, que la suite de un solo proceso no cubre. |
| 7 — Pagos | Parcial | Las suscripciones usan Checkout Pro y un webhook con firma verificada cuando hay credenciales de Mercado Pago; la simulación queda para desarrollo y pruebas. Los depósitos de reservas siguen fuera de esta integración. |
| 8 — Paneles y estadísticas | Parcial | `/api/dashboard/stats`, `/api/admin/dashboard` y `CustomerPortalView.tsx` entregan paneles básicos con datos consultados directamente de SQLite. |
| 9 — Notificaciones y reputación | Parcial | Existen tablas y rutas de notificaciones/reseñas y adaptadores locales de WhatsApp/email; no hay entrega real ni procesamiento programado completo. |
| 10 — Suscripciones y monetización | Parcial | La expiración se aplica en backend y Mercado Pago Checkout Pro activa suscripciones tras validar pagos y firmas de webhook; falta validar la integración con credenciales de producción y decidir si los negocios vencidos deben desaparecer del marketplace. |
| 11 — Calidad y estabilización | Parcial | `.github/workflows/ci.yml` ejecuta lint, pruebas automatizadas y build en cada PR y push a `main`; `tests/run-tests.ts` incluye cobertura de autorización entre negocios, roles y CRM. Faltan pruebas E2E, concurrencia, accesibilidad y cobertura de rutas nuevas. |

## Decisión sobre las implementaciones alternativas

Los PR #1 y #2 contenían una implementación alternativa. Se decidió cerrarlos al continuar desde `origin/main`; no se portó su arquitectura. Siguen pendientes ideas valiosas de esa alternativa:

- Mantener y extender la matriz de autorización entre cuentas, negocios y roles al agregar rutas.
- Pruebas de concurrencia, flujos end-to-end y recuperación ante fallos.

## Riesgos conocidos

- `npm run db:backup` verifica el respaldo y `npm run db:restore -- <archivo>` valida integridad y migraciones antes de restaurar; la restauración requiere detener el servidor y crea un respaldo `pre_restore_` si existe una base previa.
- `authorizeBusiness` y las rutas CRM aíslan los flujos cubiertos por la matriz de integración; los cambios de nuevas rutas requieren ampliar esos casos.
- Los pagos simulados de activación y checkout se bloquean en producción por defecto; `ALLOW_SIMULATED_PAYMENTS=true` solo debe usarse para demostraciones.
- La recuperación usa un adaptador local que no entrega correo real. Fuera de producción, cada correo (incluido el enlace de recuperación) se guarda en `data/dev-mail/outbox.jsonl`, ignorado por git; la consola solo indica el destinatario. En producción no se guarda el cuerpo: debe integrarse una entrega real antes de habilitar la recuperación.
- La integración de pagos de suscripción con Mercado Pago está implementada, pero falta validarla con credenciales de producción; los depósitos de reservas siguen usando el flujo simulado.
- La disponibilidad consulta reservas antes de insertar, sin una garantía atómica contra dos reservas concurrentes.

## Próximos pasos prioritarios

1. **P0 — Autorización:** mantener en GitHub Actions (`npm run lint`, `npm test` y `npm run build` por PR) la cobertura de cruces de cuentas/negocios, roles, membresías desactivadas y CRM agregada para reservas, negocio y clientes.
2. **P1 — Reservas:** mantener cobertura de creación/reprogramación concurrentes y finalización transaccional en el CRM del dueño; queda pendiente probar concurrencia multi-proceso porque la suite se ejecuta en un solo proceso.
3. **P2 — Servicios externos:** validar Mercado Pago con credenciales de producción e integrar entrega real de email.
4. **P2 — Estabilización:** ampliar pruebas E2E, de concurrencia y accesibilidad; mejorar la cobertura de rutas nuevas y validar permisos en CI.
