# DEPLOYMENT.md — Guía de Despliegue en Producción

## 1. Entorno de Ejecución

- **Plataforma:** imagen Docker en Railway, Fly.io o una VM/host con disco persistente
- **Puerto:** `PORT` de la plataforma; la imagen expone `3000`
- **Persistencia:** montar un volumen persistente en `/data`; SQLite usa `/data/salontrack.sqlite`
- **Instancias:** una sola instancia/máquina, ya que SQLite y los límites de solicitudes son locales
- **Modo:** `NODE_ENV=production`

Cloud Run no es compatible con SQLite en esta configuración: su disco local es efímero y no conserva los datos al reemplazar la instancia.

---

## 2. Variables de Entorno (`.env`)

Configure las siguientes variables en el panel de secretos de su proveedor:

```ini
# Puerto (lo inyecta la plataforma; 3000 es el valor local por defecto)
PORT=3000

# Configure el número exacto de saltos de proxy confiables.
# Por ejemplo, use 1 detrás de un único proxy de Railway, Fly o un balanceador.
# Nunca use true: confiaría cualquier X-Forwarded-For y permitiría evadir los límites por IP.
# TRUST_PROXY=1

# URL canónica del servicio; debe ser pública y usar HTTPS en producción.
APP_URL="https://salontrack.cl"

# Genere un secreto aleatorio con: openssl rand -hex 32
JWT_SECRET="<secreto-generado-con-openssl-rand-hex-32>"

# Mercado Pago Chile (Credenciales de producción)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_PUBLIC_KEY="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET=""

# Mantenga desactivados los pagos simulados; solo habilítelos en entornos de demostración.
ALLOW_SIMULATED_PAYMENTS=false

# Servicio de Correo Transaccional (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SalonTrack Chile <notificaciones@salontrack.cl>"

# Ruta de la base SQLite dentro del volumen persistente
DATABASE_FILE="/data/salontrack.sqlite"
```

Los pagos simulados están bloqueados en producción por defecto; no establezca `ALLOW_SIMULATED_PAYMENTS=true` en producción.

## Proxy confiable y límites de autenticación

Configure `TRUST_PROXY` con el número exacto de saltos de proxy confiables de su despliegue (por ejemplo, `1` detrás de un único proxy de Railway, Fly o un balanceador). No use `true`: Express confiaría cualquier valor de `X-Forwarded-For`, lo que permitiría falsificar la IP y evadir los límites. Los limitadores se mantienen en memoria y comparten estado únicamente dentro de una instancia; esta protección presupone una sola instancia.

## Correo transaccional con Resend

En el panel de Resend, verifique el dominio remitente con sus registros SPF y DKIM. Configure `RESEND_FROM_EMAIL` con una dirección de ese dominio, además de `RESEND_API_KEY`. Sin credenciales y un dominio verificado, la recuperación de contraseña no podrá enviar correos en producción.

---

## 3. Construcción y despliegue

Construya la imagen desde la raíz del repositorio:

```bash
docker build -t salontrack .
```

La imagen incluye una comprobación automática en `/api/health`. En cualquier host, monte el disco persistente en `/data`, configure las variables de entorno anteriores y mantenga una sola instancia.

### Railway

1. Despliegue el repositorio usando el `Dockerfile`.
2. Cree o adjunte un volumen al servicio y defina su ruta de montaje como `/data`.
3. Configure las variables y secretos de producción.
4. Mantenga una sola réplica para evitar escrituras concurrentes sobre SQLite.

### Fly.io

1. Cree un volumen en la misma región de la máquina, por ejemplo:

   ```bash
   fly volumes create salontrack_data --region <region> --size 1
   ```

2. Añada el montaje a `fly.toml`:

   ```toml
   [[mounts]]
   source = "salontrack_data"
   destination = "/data"
   ```

3. Configure los secretos y mantenga una sola máquina con ese volumen.

## 4. Lista previa al lanzamiento

- [ ] `JWT_SECRET` generado con `openssl rand -hex 32`.
- [ ] `MERCADO_PAGO_ACCESS_TOKEN` y `MERCADO_PAGO_WEBHOOK_SECRET` de producción configurados.
- [ ] `RESEND_API_KEY` configurada y dominio remitente verificado; `RESEND_FROM_EMAIL` pertenece a ese dominio.
- [ ] `APP_URL` configurada con la URL pública HTTPS.
- [ ] `TRUST_PROXY` configurada con el número exacto de saltos confiables; nunca usar `true`.
- [ ] URL `${APP_URL}/api/payments/webhook` registrada en Webhooks de Mercado Pago.
- [ ] Volumen persistente montado en `/data`.
- [ ] Respaldo periódico programado y copiado fuera del volumen.
- [ ] `ALLOW_SIMULATED_PAYMENTS=false`.
- [ ] `SEED_DEMO_DATA` no está definida; nunca la establezca en producción.
- [ ] Registrar primero una cuenta normal en el sitio y luego concederle `PLATFORM_ADMIN`:

  ```bash
  docker exec <contenedor> npm run admin:grant -- tu@correo.cl
  ```

  En Railway o Fly, ejecute `npm run admin:grant -- tu@correo.cl` desde la consola del contenedor.

## 5. Respaldo y restauración de SQLite

Ejecute el respaldo dentro del contenedor:

```bash
docker exec -it <contenedor> npm run db:backup
```

El archivo verificado queda en `/data/backups/`. Copie los respaldos fuera del volumen y almacene una copia remota o en otro sistema; un disco persistente no sustituye una copia externa. Por ejemplo, con Docker:

```bash
docker cp <contenedor>:/data/backups ./backups
```

Antes de restaurar, detenga el servidor para evitar escrituras concurrentes. La restauración verifica integridad y migraciones, crea un respaldo `pre_restore_` de la base actual y luego reemplaza el archivo configurado por `DATABASE_FILE`:

```bash
docker exec -it <contenedor> npm run db:restore -- /data/backups/salontrack_backup_<fecha>.sqlite --force
```

## 6. Configuración del Webhook en Mercado Pago

1. Ingrese a su consola de desarrolladores en [Mercado Pago Developers](https://www.mercadopago.cl/developers).
2. Configure `APP_URL` con la URL pública HTTPS del servicio.
3. En la sección **Webhooks**, agregue esta URL:
   `${APP_URL}/api/payments/webhook`
4. Seleccione los eventos:
   - `payment.created`
   - `payment.updated`
5. Copie el secreto de firma que muestra el panel **Webhooks** y configúrelo en `MERCADO_PAGO_WEBHOOK_SECRET`. No use un valor de ejemplo con formato `whsec_...`.
