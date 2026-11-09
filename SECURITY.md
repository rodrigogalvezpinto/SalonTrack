# SECURITY.md — Políticas y Prácticas de Seguridad

## 1. Principio de Mínimo Privilegio y Aislamiento Multi-Tenant

- Cada usuario dispone de un entorno aislado. Las consultas en el backend filtran estrictamente por el `user_id` decodificado del JWT verificado.
- Se previene la inyección de identificadores ajenos en el cuerpo o parámetros de las peticiones.

## 2. Almacenamiento Seguro de Credenciales

- Las contraseñas de las usuarias nunca se almacenan en texto plano.
- Se utiliza el algoritmo `bcryptjs` con factor de coste de 10 rondas de salt.
- No se exponen hashes de contraseñas en ninguna respuesta de la API (`JSON.parse` y filtrado explícito).

## 3. Manejo de Pagos y Cumplimiento PCI-DSS

- SalonTrack **nunca** recibe, transmite ni almacena datos de tarjetas de crédito o débito.
- Todo el procesamiento bancario y la captura de credenciales financieras ocurre dentro del entorno certificado PCI-DSS de Mercado Pago Chile (Redcompra / Webpay Plus).
- La activación de licencias comerciales requiere validación desde el backend; nunca se confía en respuestas del lado del cliente.

## 4. Protección de Datos Personales (Ley 19.628 de Chile)

- Los datos de clientas (nombres, números telefónicos, fórmulas capilares) constituyen información personal.
- La aplicación implementa:
  - Exportación completa de datos (`GET /api/backup/export`) para portabilidad.
  - Eliminación completa de registros (`DELETE /api/clients/:id`) para cumplir con el derecho al olvido.
  - Aislamiento total entre cuentas profesionales.

## 5. Prevención de Inyección y Validación de Entradas

- Todos los importes monetarios son validados y transformados a enteros en CLP (`Math.round` / `parseInt`).
- Los números de teléfono se formatean con el código de país chileno (+56) para evitar llamadas o enlaces malformados.
