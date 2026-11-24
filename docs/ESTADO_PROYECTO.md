# Estado del proyecto — SalonTrack 2.0

Auditoría de la base `origin/main` (`e141025`) y de los cambios de lanzamiento gratuito. Los estados reflejan el código disponible, no solo las pantallas.

## Avance por fase

| Fase | Estado | Evidencia |
|---|---|---|
| 0 — Auditoría y protección | Hecho | `.gitignore`, `SECURITY.md` y `docs/ROADMAP_2.0_PROMPT.md` documentan protección y alcance; los respaldos SQLite se verifican y la restauración crea un respaldo de seguridad previo. |
| 1 — Persistencia y arquitectura | Hecho | El CRM y las suscripciones usan repositorios SQLite; las escrituras multi-tabla requeridas son transaccionales; las migraciones validan checksums SHA-256 y se prueban respaldo/restauración. |
| 2 — Usuarios, roles y negocios | Parcial | `user_roles`, `business_members` y `authorizeBusiness` controlan rutas de negocio; `tests/run-tests.ts` cubre cruces entre cuentas/negocios, roles, membresías desactivadas y aislamiento CRM en los flujos principales. |
| 3 — Categorías y servicios | Parcial | Hay catálogo inicial, `/api/marketplace/categories` y CRUD de servicios en `/api/business/:id/services`; la administración completa de categorías sigue pendiente. |
| 4 — Agenda y disponibilidad | Parcial | `server/availability.ts` y `/api/availability/slots` consideran jornada, personal, pausas, reservas y bloqueos; OWNER/ADMIN configuran horarios semanales y el equipo registra ausencias con conflictos de la misma profesional detectados entre negocios. `POST /api/bookings` exige un horario publicado y libre. |
| 5 — Marketplace | Hecho | `MarketplaceView.tsx`, `/api/marketplace/search`, `/api/marketplace/business/:slug` y favoritos cubren búsqueda, filtros, ordenamiento, mapa local y perfiles públicos. |
| 6 — Reservas | Parcial | `/api/bookings` valida disponibilidad y su creación es transaccional; las reservas a domicilio guardan dirección y comuna. El tiempo de viaje entre citas a domicilio sigue pendiente. La reprogramación es autorizada y las finalizaciones escriben en el CRM del dueño con coincidencia telefónica normalizada. Las pruebas cubren creación y reprogramación simultáneas; falta concurrencia multi-proceso, que la suite de un solo proceso no cubre. |
| 7 — Pagos | Parcial | Mercado Pago Checkout Pro y el webhook firmado están implementados y fusionados en el PR #12; faltan credenciales reales y el manejo de reembolsos/contracargos. Los depósitos de reservas siguen fuera de esta integración. |
| 8 — Paneles y estadísticas | Parcial | `/api/dashboard/stats`, `/api/admin/dashboard` y `CustomerPortalView.tsx` entregan paneles básicos con datos consultados directamente de SQLite. |
| 9 — Notificaciones y reputación | Parcial | La recuperación de contraseña envía correo por Resend cuando está configurado; quedan pendientes las credenciales reales y un dominio remitente verificado. WhatsApp sigue usando el adaptador local y falta completar el procesamiento programado. |
| 10 — Suscripciones y monetización | Lanzamiento gratuito | Cada cuenta recibe 90 días de prueba. Con `BILLING_ENABLED=false` (predeterminado), la expiración no restringe el acceso y planes/checkout se ocultan. Para activar cobros, ejecutar `npm run billing:start` antes de configurar `BILLING_ENABLED=true`; después se envían avisos a 7 días y al vencimiento, y aplica el bloqueo de solo lectura. |
| 11 — Calidad y estabilización | Parcial | `.github/workflows/ci.yml` ejecuta lint, pruebas automatizadas, build y construcción de la imagen Docker en cada PR; el contenedor incluye health check de SQLite y cierre ordenado. En producción se omiten las cuentas demo y el primer `PLATFORM_ADMIN` se concede con `npm run admin:grant` tras registrar una cuenta. La elección del host y el despliegue con volumen persistente siguen pendientes. |

## Decisión sobre las implementaciones alternativas

Los PR #1 y #2 contenían una implementación alternativa. Se decidió cerrarlos al continuar desde `origin/main`; no se portó su arquitectura. Siguen pendientes ideas valiosas de esa alternativa:

- Mantener y extender la matriz de autorización entre cuentas, negocios y roles al agregar rutas.
- Pruebas de concurrencia, flujos end-to-end y recuperación ante fallos.

## Riesgos conocidos

- `npm run db:backup` verifica el respaldo y `npm run db:restore -- <archivo>` valida integridad y migraciones antes de restaurar; la restauración requiere detener el servidor y crea un respaldo `pre_restore_` si existe una base previa.
- `authorizeBusiness` y las rutas CRM aíslan los flujos cubiertos por la matriz de integración; los cambios de nuevas rutas requieren ampliar esos casos.
- Los pagos simulados de activación y checkout se bloquean en producción por defecto; `ALLOW_SIMULATED_PAYMENTS=true` solo debe usarse para demostraciones.
- Resend está integrado para la recuperación de contraseña; fuera de producción, si no hay credenciales, los correos se guardan en `data/dev-mail/outbox.jsonl`, ignorado por git. En producción se requiere `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y un dominio verificado.
- Mercado Pago real está integrado y fusionado en el PR #12; quedan pendientes credenciales reales y soporte para reembolsos/contracargos. Los depósitos de reservas siguen usando el flujo simulado.
- La facturación de suscripciones permanece desactivada durante el lanzamiento gratuito. Antes de habilitarla, ejecutar `npm run billing:start`; no activar `BILLING_ENABLED=true` sin conceder primero el margen de gracia.
- La disponibilidad consulta reservas antes de insertar, sin una garantía atómica contra dos reservas concurrentes.

## Próximos pasos prioritarios

1. **P0 — Autorización:** mantener en GitHub Actions (`npm run lint`, `npm test` y `npm run build` por PR) la cobertura de cruces de cuentas/negocios, roles, membresías desactivadas y CRM agregada para reservas, negocio y clientes.
2. **P1 — Reservas:** mantener cobertura de creación/reprogramación concurrentes y finalización transaccional en el CRM del dueño; queda pendiente probar concurrencia multi-proceso porque la suite se ejecuta en un solo proceso.
3. **P2 — Servicios externos:** configurar credenciales y dominio verificado de Resend; validar Mercado Pago con credenciales de producción y cubrir reembolsos/contracargos.
4. **P2 — Estabilización:** ampliar pruebas E2E, de concurrencia y accesibilidad; mejorar la cobertura de rutas nuevas y validar permisos en CI.
