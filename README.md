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
- **Pasarela de Pagos:** Integración con **Mercado Pago Chile** (Webpay Plus, Tarjetas de Débito Redcompra y Crédito en cuotas).

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
- **Persistencia:** Almacenamiento transaccional atómico persistente con esquemas tipados (`data/salontrack.json`), preparado para migración a PostgreSQL / Supabase.
- **Seguridad:** JWT (JSON Web Tokens), contraseñas con hashing `bcryptjs`, aislamiento multi-tenant RLS por `user_id`.
- **Pagos:** Mercado Pago Chile API & Webhooks con verificación de estado e idempotencia.

---

## 🏃‍♂️ Puesta en Marcha (Desarrollo Local)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Ejecutar pruebas automatizadas
npm test

# 4. Iniciar servidor full-stack unificado (puerto 3000)
npm run dev
```

Abre tu navegador en `http://localhost:3000`.

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias y de integración:

```bash
npm test
```

Verifica:
- Formato de moneda chilena CLP ($45.000).
- Fechas chilenas DD/MM/AAAA y zonas horarias.
- Formato de teléfono chileno (+56 9).
- Generación y codificación de enlaces de WhatsApp.
- Hashing y autenticación bcrypt.
- Aislamiento multi-tenant entre profesionales.
- Cálculo de días de inactividad para Re-engagement.
- Idempotencia en la activación de licencias de Mercado Pago.
