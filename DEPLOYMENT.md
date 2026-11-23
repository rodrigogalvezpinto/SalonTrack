# DEPLOYMENT.md — Guía de Despliegue en Producción

## 1. Entorno de Ejecución

- **Plataforma:** Google Cloud Run / Docker / Node.js 22 LTS
- **Puerto:** `3000` (definido por variable de entorno `PORT`)
- **Modo:** `NODE_ENV=production`

---

## 2. Variables de Entorno Requeridas (`.env`)

Configure las siguientes variables en el panel de secretos de su proveedor:

```ini
# Puerto del servidor
PORT=3000

# URL canónica del servicio; debe ser pública y usar HTTPS en producción.
APP_URL="https://salontrack.cl"

# Clave secreta para firma de JSON Web Tokens (mínimo 32 caracteres)
JWT_SECRET="salontrack_prod_jwt_secret_chile_2026_super_secure"

# Mercado Pago Chile (Credenciales de producción)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_PUBLIC_KEY="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET=""

# Mantenga desactivados los pagos simulados; solo habilítelos en entornos de demostración.
ALLOW_SIMULATED_PAYMENTS=false

# Servicio de Correo Transaccional (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SalonTrack Chile <notificaciones@salontrack.cl>"

# Ruta persistente de la base SQLite (por defecto: ./data/salontrack.sqlite)
DATABASE_FILE="./data/salontrack.sqlite"
```

Los pagos simulados están bloqueados en producción por defecto; no establezca `ALLOW_SIMULATED_PAYMENTS=true` en producción.

## Correo transaccional con Resend

En el panel de Resend, verifique el dominio remitente con sus registros SPF y DKIM. Configure `RESEND_FROM_EMAIL` con una dirección de ese dominio, además de `RESEND_API_KEY`. Sin credenciales y un dominio verificado, la recuperación de contraseña no podrá enviar correos en producción.

---

## 3. Pasos de Compilación y Lanzamiento

```bash
# 1. Compilar los assets frontend de Vite
npm run build

# 2. Iniciar el servidor Express en producción
npm run start
```

---

## 4. Respaldo y restauración de la base SQLite

Crea y verifica un respaldo con:

```bash
npm run db:backup
```

Antes de restaurar, detén el servidor para evitar escrituras concurrentes. La restauración verifica integridad y migraciones, crea un respaldo `pre_restore_` de la base actual y luego reemplaza el archivo configurado por `DATABASE_FILE`:

```bash
npm run db:restore -- ./data/backups/salontrack_backup_<fecha>.sqlite
```

En producción, agrega `--force` para confirmar la operación:

```bash
npm run db:restore -- ./data/backups/salontrack_backup_<fecha>.sqlite --force
```

## 5. Configuración del Webhook en Mercado Pago

1. Ingrese a su consola de desarrolladores en [Mercado Pago Developers](https://www.mercadopago.cl/developers).
2. Configure `APP_URL` con la URL pública HTTPS del servicio.
3. En la sección **Webhooks**, agregue esta URL:
   `${APP_URL}/api/payments/webhook`
4. Seleccione los eventos:
   - `payment.created`
   - `payment.updated`
5. Copie el secreto de firma que muestra el panel **Webhooks** y configúrelo en `MERCADO_PAGO_WEBHOOK_SECRET`. No use un valor de ejemplo con formato `whsec_...`.
