# TESTING.md — Estrategia y Ejecución de Pruebas

## 1. Alcance de las Pruebas

La suite de pruebas automatizadas de SalonTrack valida los aspectos críticos del negocio:

1. **Formato Monetario Chileno (CLP):** Asegura que los precios se muestren con separador de miles en punto, sin decimales y con el prefijo `$`.
2. **Formato de Fechas Chilenas:** Garantiza el estándar `DD/MM/AAAA`.
3. **Formato de Teléfonos:** Valida la estructura `+56 9 XXXX XXXX`.
4. **Construcción de Enlaces WhatsApp:** Verifica el prefijo `https://wa.me/569...` y la codificación URI de los caracteres en español (tildes, signos de exclamación).
5. **Personalización de Plantillas:** Prueba el reemplazo de etiquetas `{nombre}`, `{salon}`, `{servicio}`.
6. **Seguridad y Criptografía:** Prueba que `bcryptjs` genere hashes distintos y verifique contraseñas de forma confiable.
7. **Aislamiento Multi-Tenant (RLS):** Garantiza que una consulta para el `user1` jamás devuelva clientas del `user2`.
8. **Cálculo de Fechas de Retoque:** Valida la suma exacta de días según el intervalo del servicio.
9. **Módulo de Re-engagement:** Verifica el filtro de días de inactividad (>= 90 días).
10. **Idempotencia de Pagos:** Asegura que un pago con el mismo identificador no se compute dos veces.

---

## 2. Ejecución de Pruebas

```bash
npm test     # node:test vía tsx: tests/unit.test.ts + tests/integration.test.ts
npm run lint # tsc --noEmit
npm run build
```

Cada archivo de pruebas usa una base SQLite temporal propia (ver `tests/helpers.ts`); nunca toca `data/salontrack.sqlite`.

Las pruebas de integración levantan la API real (`createApp()`) en un puerto aleatorio y cubren: autenticación y recuperación de contraseña, rate limiting, aislamiento entre profesionales, transacciones y cascadas, escrituras concurrentes, idempotencia de licencias, migración JSON v1 (incluida re-ejecución), datos demo, persistencia tras reabrir la base, backup/restore y errores centralizados.
