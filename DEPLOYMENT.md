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

# URL canónica del servicio (usada en webhooks y enlaces PWA)
APP_URL="https://salontrack.cl"

# Clave secreta para firma de JSON Web Tokens (mínimo 32 caracteres)
JWT_SECRET="salontrack_prod_jwt_secret_chile_2026_super_secure"

# Mercado Pago Chile (Credenciales de producción)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_PUBLIC_KEY="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET="whsec_..."

# Servicio de Correo Transaccional (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SalonTrack Chile <notificaciones@salontrack.cl>"

# Ruta de almacenamiento
DATABASE_FILE="./data/salontrack.sqlite"
```

---

## 3. Pasos de Compilación y Lanzamiento

```bash
# 1. Compilar los assets frontend de Vite
npm run build

# 2. Iniciar el servidor Express en producción
npm run start
```

---

## 4. Configuración del Webhook en Mercado Pago

1. Ingrese a su consola de desarrolladores en [Mercado Pago Developers](https://www.mercadopago.cl/developers).
2. En la sección **Webhooks / Notificaciones IPN**, agregue la URL:
   `https://su-dominio.cl/api/payments/webhook`
3. Seleccione los eventos:
   - `payment.created`
   - `payment.updated`
4. Copie el Secreto de Firma y configúrelo en la variable `MERCADO_PAGO_WEBHOOK_SECRET`.
