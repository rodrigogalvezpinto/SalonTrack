# SalonTrack Chile 🇨🇱 — Gestión Inteligente de Retoques para Peluquerías

> **Micro-SaaS & Aplicación Web Progresiva (PWA)** diseñada especialmente para peluqueras independientes, estilistas, coloristas y pequeños salones de belleza en Chile.

---

## 🎯 Propósito del Producto

Muchas peluqueras en Chile gestionan sus clientas en libretas de papel, notas del celular o chats de WhatsApp desordenados. Esto genera:
- **Olvidar fechas recomendadas de retoque** (raíz crecida, balayage apagado, matiz desvanecido).
- **Pérdida de clientas** que, al verse la raíz crecida, terminan atendiendo con otra estilista.
- **Falta de visibilidad de ingresos futuros** y oportunidades comerciales.
- **Clientas inactivas** que no regresan y no son recontactadas.

**SalonTrack** centraliza esta información, calcula automáticamente las fechas estimadas de retoque según el servicio específico, permite enviar recordatorios personalizados por WhatsApp en 1 solo clic y cuenta con un **Módulo de Re-engagement** para recuperar clientas inactivas.

---

## 🇨🇱 Configuración Regional para Chile

- **Moneda:** Peso Chileno (**CLP** - `$`), almacenado y procesado como enteros sin decimales (separador de miles con punto: `$45.000`).
- **Zona Horaria:** `America/Santiago` con soporte para cambios de horario de verano.
- **Formato de Fechas:** `DD/MM/AAAA`.
- **Formato de Teléfono:** Prefijo internacional de Chile `+56 9 XXXX XXXX`.
- **Pasarela de Pagos:** checkout local simulado; integración con **Mercado Pago Chile** diseñada como adaptador intercambiable (no activa por defecto).

---

## 🚀 Funcionalidades Principales

1. **Dashboard de Negocio & Oportunidades:**
   - Métricas en tiempo real: Total de clientas, retoques de la semana, ingresos potenciales del mes en CLP, clientas por contactar.
   - Aclaración contable: distingo riguroso entre oportunidades estimadas e ingresos efectivamente cobrados.
2. **Ficha Técnica & Control de Clientas:**
   - Registro de nombres, teléfonos y notas particulares (ej. cuero cabelludo sensible, café favorito).
   - Historial de fórmulas técnicas (ej. *Majirel 7.1 (30g) + 7.0 (20g) + Ox 20vol (75ml)*) y marcas de tinte utilizadas.
3. **Historial de Servicios (Relación 1 a N):**
   - Cada visita almacena fecha real, valor cobrado (CLP), fórmula empleada y próximo retoque recomendado (20, 30, 45, 60 o 90 días).
4. **Integración con WhatsApp:**
   - Botón directo **"AVISAR POR WHATSAPP"** que genera un mensaje cortés precompletado con nombre de clienta, salón y servicio.
   - Registro automático en el historial de contactos.
5. **Módulo de Re-engagement (Recuperación de Clientas):**
   - Identifica clientas que no visitan el salón hace 2 meses (60 días), 3 meses (90 días) o 6 meses (180 días).
   - Cálculo del dinero potencial a recuperar en CLP.
   - Envío de mensajes con ofertas o descuentos especiales (ej. 15% de descuento en retoque).
   - Control de estados: *Pendiente*, *Recontactada*, *Reactivada (Cita Agendada)* o *Descartada*.
6. **Notificaciones Push Configurables:**
   - Alertas diarias matutinas en horario chileno (ej. 09:00 AM) para avisar de clientas con retoques del día o de la semana.
   - Alerta sonora y botón de prueba integrado.
7. **Calendario Mensual & Semanal:**
   - Vista interactiva de visitas y fechas estimadas de retoque.
8. **Planes de Comercialización en CLP:**
   - Plan Mensual: **$9.990 CLP**
   - Plan Trimestral Pro (Recomendado): **$14.990 CLP**
   - Plan Semestral Fundador: **$19.990 CLP**
   - Pasarela con validación backend e idempotencia.
9. **Instalabilidad PWA (Progressive Web App):**
   - Instalable en Android y escritorio con un clic.
   - Guía paso a paso integrada para usuarios de iOS Safari ("Compartir" -> "Agregar al inicio").
   - Detección de conectividad y modo offline con alerta.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide React, Motion.
- **Backend:** Express, Node.js 22, TypeScript (tsx).
- **Persistencia:** SQLite (`better-sqlite3`) con migraciones versionadas, claves foráneas, transacciones y capa de repositorios, preparado para migrar a PostgreSQL. Los datos del JSON v1 se importan automáticamente.
- **Seguridad:** JWT (JSON Web Tokens), contraseñas con hashing `bcryptjs`, aislamiento multi-tenant RLS por `user_id`.
- **Pagos:** proveedor local simulado por defecto (`PAYMENT_PROVIDER=local`); adaptador de Mercado Pago preparado para una etapa posterior.

---

## 🏃‍♂️ Puesta en Marcha (Desarrollo Local)

Requisitos: Node.js 22 o superior y npm. No se necesitan credenciales externas.

```bash
npm install          # instala dependencias (incluye SQLite embebido)
cp .env.example .env # opcional: valores locales por defecto
npm run dev          # servidor full-stack en http://localhost:3000
```

Al iniciar, el servidor crea `data/salontrack.sqlite`, aplica las migraciones pendientes, importa los datos de `data/salontrack.json` (v1) si existen y, si la base está vacía, carga la cuenta demo.

### Base de datos

| Comando | Descripción |
|---|---|
| `npm run db:migrate` | Aplica migraciones pendientes y muestra las aplicadas |
| `npm run db:seed` | Carga los datos demo (idempotente) |
| `npm run db:reset` | Elimina y recrea **solo** las cuentas demo (los datos reales no se tocan) |
| `npm run db:backup [-- destino]` | Respaldo consistente en caliente en `data/backups/` |
| `npm run db:restore -- <archivo>` | Restaura un respaldo (con el servidor detenido); antes guarda una copia `pre-restore-*` |
| `npm run db:import-json [-- archivo] [--force]` | Importa el JSON v1 de forma idempotente |

### Cuenta de prueba (solo desarrollo local)

- Profesional: `contacto@valeriaestudio.cl` / `Salon1234`

### Recuperación de contraseña en local

El correo se simula: el enlace con el token aparece en la consola del servidor y queda registrado en la tabla `notification_delivery_logs`.

### Estructura

```
server.ts               arranque (Vite en desarrollo, estáticos en producción)
server/app.ts           app Express de la API (usada también por las pruebas)
server/config.ts        configuración desde variables de entorno
server/db/              conexión SQLite, migraciones, importación JSON v1, seed, backup
server/repositories/    acceso a datos (SQL parametrizado)
server/routes/          endpoints REST por dominio
server/providers/       adaptadores de pagos, email y WhatsApp (local / reales)
server/lib/             errores, validación, fechas Chile, rate limit, auditoría
scripts/db.ts           comandos db:*
docs/                   auditoría y documentación de fases
```

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias y de integración:

```bash
npm test
```

Pruebas unitarias y de integración (`node:test`) contra una base SQLite temporal. Verifica, entre otros:
- Registro, correo duplicado, login, contraseña incorrecta, tokens inválidos y rate limiting.
- Recuperación de contraseña con token de un solo uso.
- Aislamiento entre profesionales (lectura, edición, borrado y escritura sobre clientas ajenas).
- Transacciones, borrado en cascada y escrituras concurrentes.
- Migración JSON v1 → SQLite sin duplicados al re-ejecutarse.
- Persistencia tras reabrir la base, respaldo y restauración.
- Formato de moneda chilena CLP ($45.000).
- Fechas chilenas DD/MM/AAAA y zonas horarias.
- Formato de teléfono chileno (+56 9).
- Generación y codificación de enlaces de WhatsApp.
- Hashing y autenticación bcrypt.
- Aislamiento multi-tenant entre profesionales.
- Cálculo de días de inactividad para Re-engagement.
- Idempotencia en la activación de licencias (sin pagos duplicados).
