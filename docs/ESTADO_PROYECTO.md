# Estado del proyecto — SalonTrack 2.0

Auditoría de la base `origin/main` (`9a75d5a`) y de los endurecimientos puntuales de esta rama. Los estados reflejan el código disponible, no solo las pantallas.

## Avance por fase

| Fase | Estado | Evidencia |
|---|---|---|
| 0 — Auditoría y protección | Hecho | `.gitignore`, `SECURITY.md` y `docs/ROADMAP_2.0_PROMPT.md` documentan protección y alcance; los respaldos SQLite se verifican y la restauración crea un respaldo de seguridad previo. |
| 1 — Persistencia y arquitectura | Hecho | El CRM y las suscripciones usan repositorios SQLite; las escrituras multi-tabla requeridas son transaccionales; las migraciones validan checksums SHA-256 y se prueban respaldo/restauración. |
| 2 — Usuarios, roles y negocios | Parcial | `user_roles`, `business_members` y `authorizeBusiness` controlan rutas de negocio; `tests/run-tests.ts` cubre cruces entre cuentas/negocios, roles, membresías desactivadas y aislamiento CRM en los flujos principales. |
| 3 — Categorías y servicios | Parcial | Hay catálogo inicial, `/api/marketplace/categories` y CRUD de servicios en `/api/business/:id/services`; la administración completa de categorías sigue pendiente. |
| 4 — Agenda y disponibilidad | Parcial | `server/availability.ts` y `/api/availability/slots` consideran jornada, personal, reservas y bloqueos; no hay garantía transaccional frente a solicitudes simultáneas. |
| 5 — Marketplace | Hecho | `MarketplaceView.tsx`, `/api/marketplace/search`, `/api/marketplace/business/:slug` y favoritos cubren búsqueda, filtros, ordenamiento, mapa local y perfiles públicos. |
| 6 — Reservas | Parcial | `/api/bookings` y sus acciones de confirmar, rechazar, cancelar y completar existen; faltan reprogramación y expiración automatizada. |
| 7 — Pagos locales | Parcial | El checkout y la activación simulados se bloquean en producción salvo `ALLOW_SIMULATED_PAYMENTS=true` para demos; `/api/payments/webhook` no valida operaciones externas. |
| 8 — Paneles y estadísticas | Parcial | `/api/dashboard/stats`, `/api/admin/dashboard` y `CustomerPortalView.tsx` entregan paneles básicos con datos consultados directamente de SQLite. |
| 9 — Notificaciones y reputación | Parcial | Existen tablas y rutas de notificaciones/reseñas y adaptadores locales de WhatsApp/email; no hay entrega real ni procesamiento programado completo. |
| 10 — Suscripciones y monetización | Parcial | `/api/subscriptions/plans` y `subscriptions` implementan planes; la activación simulada tiene bloqueo de producción y aún faltan límites de plan aplicados consistentemente en backend. |
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
- El checkout, la activación y el webhook siguen siendo simulados; no se verifican firmas de proveedor ni se debe tratar su respuesta como confirmación real de pago.
- La disponibilidad consulta reservas antes de insertar, sin una garantía atómica contra dos reservas concurrentes.

## Próximos pasos prioritarios

1. **P0 — Autorización:** mantener en GitHub Actions (`npm run lint`, `npm test` y `npm run build` por PR) la cobertura de cruces de cuentas/negocios, roles, membresías desactivadas y CRM agregada para reservas, negocio y clientes.
2. **P1 — Reservas:** hacer atómica la comprobación e inserción de turnos; completar reprogramación, expiración e integración transaccional con CRM.
3. **P2 — Servicios externos:** reemplazar la simulación de email y pagos e implementar validación de firmas de webhook.
4. **P2 — Estabilización:** ampliar pruebas E2E, de concurrencia y accesibilidad; cubrir límites de suscripción y validación de permisos en CI.
