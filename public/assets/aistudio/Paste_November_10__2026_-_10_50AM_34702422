# SALONTRACK 2.0
## ROADMAP MAESTRO DE PRODUCTO, FUNCIONALIDADES, ARQUITECTURA Y PLAN DE IMPLEMENTACIÓN

**Tipo de proyecto:** Evolución de una plataforma SaaS hacia un ecosistema de gestión de negocios, marketplace de servicios y reservas online.

**Mercado inicial:** Chile.

**Idioma:** Español.

**Moneda:** CLP.

**Zona horaria:** America/Santiago.

**Entorno prioritario:** Desarrollo local, completamente funcional y sin dependencias externas obligatorias.

**Nombre del producto:** SalonTrack.

**Versión objetivo:** 2.0.

---

# 1. INSTRUCCIÓN PRINCIPAL PARA EL AGENTE DE DESARROLLO

Debes trabajar sobre el repositorio existente de SalonTrack.

NO debes crear otro proyecto desde cero.

NO debes reemplazar innecesariamente la arquitectura existente.

NO debes eliminar funcionalidades que ya están implementadas.

NO debes modificar la identidad visual existente sin una justificación funcional.

NO debes asumir que una funcionalidad está terminada simplemente porque aparece mencionada en la documentación.

Antes de modificar cualquier archivo:

1. Inspecciona el repositorio completo.
2. Identifica todas las funcionalidades implementadas.
3. Identifica los componentes, vistas, rutas y servicios existentes.
4. Revisa el modelo actual de datos.
5. Revisa las API actuales.
6. Identifica las dependencias entre módulos.
7. Determina qué funcionalidades pueden reutilizarse.
8. Identifica los riesgos de compatibilidad.
9. Diseña las migraciones necesarias.
10. Presenta y ejecuta una implementación incremental.

El objetivo es transformar SalonTrack en una plataforma donde cualquier profesional pueda administrar su negocio, publicar sus servicios, recibir reservas y gestionar clientes, mientras que cualquier persona pueda descubrir profesionales cercanos, comparar servicios y reservar una atención.

La aplicación debe funcionar completamente en local, con persistencia real, datos de prueba, procesos simulados cuando corresponda y sin requerir credenciales de terceros.

Las integraciones externas deben quedar diseñadas mediante adaptadores intercambiables, para que posteriormente puedan activarse mediante configuración.

---

# 2. VISIÓN DEL PRODUCTO

SalonTrack evolucionará desde una herramienta de gestión para profesionales de peluquería hacia una plataforma integral de servicios profesionales.

La plataforma tendrá tres grandes experiencias:

## 2.1. Marketplace para clientes

Permitirá descubrir profesionales y negocios cercanos, consultar sus servicios, precios, fotografías, disponibilidad, reputación y reservar directamente.

Ejemplos de búsqueda:

- Peluquerías cerca de mí.
- Barberías en Renca.
- Manicure disponible hoy.
- Masajes para el sábado.
- Peluquería a domicilio.
- Depilación cerca de mi ubicación.
- Corte de cabello por menos de $20.000.
- Profesionales disponibles después de las 18:00.

## 2.2. Portal de profesionales y negocios

Permitirá a cualquier profesional:

- Crear su perfil.
- Registrar su negocio.
- Publicar servicios.
- Configurar precios.
- Administrar trabajadores.
- Configurar horarios.
- Recibir reservas.
- Confirmar o rechazar solicitudes.
- Administrar clientes.
- Registrar servicios realizados.
- Gestionar pagos.
- Consultar estadísticas.
- Gestionar su agenda.
- Administrar su reputación.

## 2.3. Administración de SalonTrack

Permitirá administrar la plataforma:

- Usuarios.
- Profesionales.
- Negocios.
- Categorías.
- Servicios.
- Publicaciones.
- Reservas.
- Reseñas.
- Suscripciones.
- Configuraciones generales.
- Moderación.
- Métricas del marketplace.

La arquitectura debe permitir que una misma cuenta pueda actuar como cliente y profesional.

Una persona no debe necesitar dos cuentas diferentes para utilizar ambos roles.

---

# 3. REGLAS GENERALES DEL PRODUCTO

Estas decisiones son obligatorias:

1. SalonTrack debe soportar múltiples categorías de servicios.
2. El producto no debe limitarse a peluquerías.
3. Un negocio puede tener uno o varios profesionales.
4. Un profesional independiente puede administrar su propio negocio.
5. Un usuario puede pertenecer a más de un negocio.
6. Un usuario puede ser cliente y profesional simultáneamente.
7. Las reservas deben admitir confirmación automática y manual.
8. Los pagos deben admitir modalidad presencial y online.
9. La aplicación debe funcionar sin integraciones externas.
10. Toda operación debe persistir correctamente.
11. El backend debe validar las operaciones críticas.
12. Los permisos deben aplicarse en el backend, no solamente en la interfaz.
13. Los datos privados de un negocio no deben ser accesibles desde otro.
14. Las funcionalidades existentes del CRM deben mantenerse.
15. Toda funcionalidad nueva debe contar con estados, validaciones y manejo de errores.
16. El sistema debe ser responsive y utilizable desde dispositivos móviles.
17. El sistema debe poder ejecutarse desde un entorno local sin claves de terceros.
18. Los datos de demostración deben estar separados de los datos reales del usuario.

---

# 4. ARQUITECTURA Y TECNOLOGÍAS

## 4.1. Tecnologías actuales que deben conservarse

Mantener como base:

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- Express.
- Node.js.
- REST API.
- JWT.
- bcrypt.
- PWA.

No introducir una reescritura completa del frontend ni del backend.

## 4.2. Persistencia

La persistencia actual mediante archivo JSON debe evolucionar.

Implementar SQLite como base de datos local.

Requisitos:

- Base de datos persistente en disco.
- Migraciones versionadas.
- Relaciones entre entidades.
- Índices.
- Restricciones de integridad.
- Transacciones.
- Claves foráneas.
- Consultas parametrizadas.
- Protección ante escrituras concurrentes.
- Backups.
- Restauración.
- Datos de prueba controlados.

Utilizar una capa de repositorios para que las funcionalidades no dependan directamente del motor de base de datos.

Preparar el diseño para una migración posterior a PostgreSQL.

No introducir Supabase como dependencia obligatoria.

## 4.3. Arquitectura lógica

Frontend React:

- Marketplace.
- Portal profesional.
- Portal cliente.
- Administración.

Backend Express:

- Autenticación.
- Usuarios.
- Negocios.
- Profesionales.
- Servicios.
- Catálogo.
- Disponibilidad.
- Reservas.
- Pagos.
- CRM.
- Reseñas.
- Notificaciones.
- Suscripciones.
- Administración.

Persistencia:

- SQLite local.
- Migraciones.
- Repositorios.
- Transacciones.

Integraciones futuras:

- Mercado Pago.
- WhatsApp Business.
- Email.
- Geocodificación.
- Mapas.
- Notificaciones push.

Cada integración debe utilizar un adaptador desacoplado.

---

# 5. MÓDULO DE AUTENTICACIÓN Y USUARIOS

## 5.1. Registro

Permitir registrarse mediante:

- Nombre.
- Apellido.
- Correo electrónico.
- Teléfono.
- Contraseña.
- Confirmación de contraseña.
- Aceptación de términos.

Validaciones:

- Correo válido.
- Correo único.
- Contraseña segura.
- Teléfono válido.
- Campos obligatorios.
- Mensajes de error comprensibles.

En local, el registro debe funcionar sin confirmación de correo externa.

## 5.2. Inicio de sesión

Permitir:

- Correo y contraseña.
- Cierre de sesión.
- Persistencia de sesión.
- Renovación o expiración de sesión.
- Recuperación de contraseña local mediante un flujo de demostración seguro.

No utilizar secretos JWT predeterminados en producción.

En desarrollo, utilizar variables de entorno locales.

## 5.3. Perfiles y roles

Separar identidad y roles.

Roles principales:

- CUSTOMER.
- PROFESSIONAL.
- BUSINESS_OWNER.
- BUSINESS_ADMIN.
- BUSINESS_STAFF.
- PLATFORM_ADMIN.

Un usuario puede tener varios roles.

La autorización debe considerar el negocio al que pertenece el usuario.

No permitir que un profesional consulte o modifique información privada de otro negocio.

## 5.4. Perfil personal

Permitir administrar:

- Nombre.
- Apellido.
- Fotografía.
- Teléfono.
- Correo.
- Dirección personal opcional.
- Preferencias.
- Notificaciones.
- Ubicación preferida.

No exponer información privada en perfiles públicos.

---

# 6. MÓDULO DE NEGOCIOS Y PROFESIONALES

Crear el módulo Mi negocio.

## 6.1. Creación de negocio

Campos:

- Nombre comercial.
- Descripción.
- Logotipo.
- Imagen de portada.
- Categoría principal.
- Especialidades.
- Teléfono.
- WhatsApp.
- Correo comercial.
- Sitio web.
- Instagram.
- Facebook.
- Dirección.
- Comuna.
- Región.
- País.
- Latitud.
- Longitud.
- Modalidad de atención.
- Horarios.
- Estado de publicación.

Un profesional independiente puede crear un negocio con un único trabajador.

## 6.2. Modalidades de atención

Admitir:

- Atención en establecimiento.
- Atención a domicilio del cliente.
- Atención remota, cuando corresponda.
- Combinación de modalidades.

Para atención a domicilio, permitir configurar comunas y radios de cobertura.

Para profesionales que trabajan desde su domicilio, no mostrar automáticamente su dirección particular.

## 6.3. Estado del negocio

Estados:

- DRAFT.
- PENDING_REVIEW.
- PUBLISHED.
- SUSPENDED.
- INACTIVE.

Reglas:

- Un negocio nuevo comienza como borrador.
- Puede completar sus datos antes de publicar.
- Debe cumplir los requisitos mínimos para publicarse.
- Un negocio suspendido no debe aparecer en las búsquedas públicas.
- Un negocio inactivo no debe aceptar nuevas reservas.

## 6.4. Equipo de trabajo

Permitir:

- Agregar trabajadores.
- Editar trabajadores.
- Desactivar trabajadores.
- Asignar especialidades.
- Asignar servicios.
- Configurar horarios.
- Administrar disponibilidad.
- Consultar reservas.
- Administrar permisos.

Un trabajador puede estar asociado a más de un servicio.

Un negocio puede tener varias agendas individuales.

## 6.5. Permisos internos

Propietario:

- Control completo del negocio.

Administrador:

- Administración operativa.

Profesional:

- Gestión de sus servicios y agenda.

Recepción:

- Administración de reservas y clientes según permisos.

Los permisos deben validarse en backend.

---

# 7. MÓDULO DE CATEGORÍAS

El marketplace debe ser extensible.

No utilizar categorías codificadas exclusivamente en componentes frontend.

Crear un catálogo administrable.

Categorías iniciales:

1. Peluquería.
2. Barbería.
3. Manicure.
4. Pedicure.
5. Uñas.
6. Maquillaje.
7. Estética facial.
8. Estética corporal.
9. Depilación.
10. Masajes.
11. Bienestar.
12. Spa.
13. Tratamientos capilares.
14. Servicios de belleza.
15. Otros servicios.

Cada categoría puede tener subcategorías.

Ejemplos:

Peluquería:
- Corte.
- Coloración.
- Balayage.
- Mechas.
- Tratamientos.
- Alisado.
- Peinados.

Barbería:
- Corte masculino.
- Perfilado de barba.
- Afeitado.
- Diseño.

Uñas:
- Manicure.
- Pedicure.
- Esmaltado permanente.
- Soft gel.
- Acrílicas.

El administrador debe poder crear nuevas categorías sin modificar código.

---

# 8. MÓDULO DE SERVICIOS

Cada negocio debe poder publicar múltiples servicios.

## 8.1. Datos del servicio

- Nombre.
- Categoría.
- Subcategoría.
- Descripción.
- Fotografías.
- Precio.
- Tipo de precio.
- Duración.
- Tiempo de preparación.
- Tiempo de limpieza.
- Modalidad.
- Profesional habilitado.
- Requisitos.
- Indicaciones previas.
- Política de cancelación.
- Disponibilidad.
- Estado.

## 8.2. Tipos de precio

Admitir:

- Precio fijo.
- Precio desde.
- Precio variable.
- Precio sujeto a evaluación.

Ejemplo:

Balayage:

- Precio desde $75.000.
- Duración estimada: 180 minutos.
- Precio definitivo sujeto a evaluación.

## 8.3. Estados

- DRAFT.
- PUBLISHED.
- INACTIVE.

## 8.4. Gestión

Permitir:

- Crear servicio.
- Editar servicio.
- Eliminar o archivar.
- Duplicar.
- Cambiar precio.
- Cambiar duración.
- Asignar trabajadores.
- Destacar servicios.
- Ordenar catálogo.

No eliminar servicios que ya formen parte del historial de una reserva completada.

---

# 9. MARKETPLACE PÚBLICO

Crear una experiencia de búsqueda independiente del portal profesional.

Ruta sugerida:

/explore

## 9.1. Página principal

Elementos:

- Barra de búsqueda.
- Selector de ubicación.
- Categorías.
- Profesionales destacados.
- Negocios cercanos.
- Disponibilidad para hoy.
- Mejor evaluados.
- Servicios populares.
- Recomendaciones.
- Últimos negocios visitados.
- Acceso a perfil y reservas.

## 9.2. Buscador

Debe permitir buscar por:

- Nombre del negocio.
- Nombre del profesional.
- Categoría.
- Subcategoría.
- Servicio.
- Comuna.
- Región.
- Palabras clave.

Ejemplos:

"Barbería en Renca".

"Manicure cerca de mí".

"Balayage disponible el sábado".

"Masajes a domicilio".

Implementar búsqueda en backend.

No descargar todos los negocios para filtrarlos exclusivamente en frontend.

## 9.3. Filtros

Permitir combinar:

Ubicación:
- 1 km.
- 3 km.
- 5 km.
- 10 km.
- 20 km.
- 50 km.

Categoría:
- Una o varias.

Precio:
- Mínimo.
- Máximo.

Calificación:
- 3 estrellas o más.
- 4 estrellas o más.
- 4,5 estrellas o más.

Disponibilidad:
- Hoy.
- Mañana.
- Esta semana.
- Fecha específica.

Horario:
- Mañana.
- Tarde.
- Noche.

Modalidad:
- En establecimiento.
- A domicilio.
- Remoto.

Profesional:
- Independiente.
- Negocio con equipo.

## 9.4. Ordenamiento

- Relevancia.
- Más cercanos.
- Mejor evaluados.
- Precio menor.
- Precio mayor.
- Próxima disponibilidad.
- Más populares.

## 9.5. Geolocalización

Implementar geolocalización mediante la API del navegador.

Solicitar permiso explícito.

Si el usuario no autoriza:

- Permitir introducir comuna.
- Permitir introducir dirección o ubicación manual.
- Mantener operativo el buscador.

Utilizar coordenadas guardadas para calcular distancias.

Implementar fórmula de Haversine en backend o servicio de dominio.

No exigir API de mapas para calcular distancias.

## 9.6. Mapa

Crear una vista de resultados:

- Lista.
- Mapa.
- Vista combinada.

En modo local, el mapa debe tener una representación funcional sin necesitar claves de terceros.

Se puede implementar una visualización local de ubicaciones sobre un plano o mapa disponible, con marcadores y selección de negocios.

La integración posterior con un proveedor de mapas debe ser intercambiable.

Los marcadores y la lista deben compartir los mismos filtros.

Al seleccionar un negocio en el mapa, mostrar:

- Nombre.
- Fotografía.
- Calificación.
- Distancia.
- Servicio destacado.
- Precio desde.
- Próxima disponibilidad.

Si no hay coordenadas suficientes, mostrar resultados en lista e informar que no es posible ubicarlos en el mapa.

## 9.7. Tarjeta de negocio

Mostrar:

- Fotografía.
- Logotipo.
- Nombre.
- Categoría.
- Comuna.
- Distancia.
- Calificación.
- Cantidad de reseñas.
- Precio desde.
- Próxima disponibilidad.
- Modalidad.
- Botón Ver perfil.
- Botón Reservar.

---

# 10. PERFIL PÚBLICO DEL NEGOCIO

Cada negocio publicado tendrá una página pública.

Ruta sugerida:

/business/:slug

Contenido:

1. Portada.
2. Logotipo.
3. Nombre.
4. Categorías.
5. Descripción.
6. Ubicación.
7. Distancia aproximada.
8. Horarios.
9. Contacto.
10. WhatsApp.
11. Redes sociales.
12. Fotografías.
13. Servicios.
14. Precios.
15. Duración.
16. Equipo.
17. Calificación.
18. Reseñas.
19. Disponibilidad.
20. Botón Reservar.

Permitir compartir la página.

El slug debe ser único.

La página debe ser pública y no requerir autenticación para consultar el catálogo.

Para reservar, solicitar autenticación cuando corresponda.

---

# 11. MOTOR DE DISPONIBILIDAD Y AGENDA

Este módulo es crítico.

Debe calcular disponibilidad real considerando todos los elementos que afectan una reserva.

## 11.1. Configuración del negocio

Permitir establecer:

- Horarios por día.
- Días de atención.
- Días cerrados.
- Feriados.
- Descansos.
- Horarios especiales.
- Capacidad.
- Anticipación mínima.
- Anticipación máxima.
- Tiempo entre reservas.
- Política de cancelación.

## 11.2. Configuración individual

Cada trabajador tendrá:

- Horarios.
- Descansos.
- Bloqueos.
- Servicios habilitados.
- Duración de servicios.
- Vacaciones.
- Ausencias.
- Capacidad individual.

## 11.3. Disponibilidad

El motor debe considerar:

- Horarios del negocio.
- Horarios del trabajador.
- Duración del servicio.
- Preparación.
- Limpieza.
- Reservas existentes.
- Bloqueos.
- Anticipación.
- Zona horaria.

## 11.4. Generación de horarios

Generar los horarios disponibles según la duración del servicio.

No utilizar intervalos rígidos de 30 minutos para todos los servicios.

Ejemplo:

Un servicio de 90 minutos no puede ofrecer una hora que termine fuera del horario laboral.

Si existe un buffer de 15 minutos, debe considerarse en el cálculo.

## 11.5. Bloqueos

Permitir:

- Bloquear un día.
- Bloquear una franja.
- Bloquear vacaciones.
- Bloquear un trabajador.
- Bloquear el negocio completo.

## 11.6. Concurrencia

La validación final debe realizarse en backend.

La creación de una reserva debe ejecutarse dentro de una transacción.

No permitir dos reservas que se superpongan para el mismo trabajador.

Revalidar disponibilidad inmediatamente antes de confirmar.

Implementar protección contra solicitudes duplicadas mediante idempotencia.

---

# 12. SISTEMA DE RESERVAS

## 12.1. Flujo del cliente

1. Buscar un servicio.
2. Seleccionar negocio.
3. Seleccionar servicio.
4. Seleccionar profesional.
5. Elegir fecha.
6. Consultar horarios disponibles.
7. Seleccionar horario.
8. Ingresar observaciones.
9. Seleccionar modalidad de atención.
10. Revisar resumen.
11. Seleccionar forma de pago.
12. Confirmar reserva.

El cliente debe recibir un comprobante con:

- Código de reserva.
- Negocio.
- Profesional.
- Servicio.
- Fecha.
- Hora.
- Duración.
- Precio.
- Forma de pago.
- Estado.

## 12.2. Modos de confirmación

El negocio debe elegir entre:

AUTOMÁTICA:

- Si el horario está disponible, la reserva queda confirmada.
- Se bloquea la agenda.
- Se notifica al profesional y al cliente.

MANUAL:

- La reserva queda pendiente.
- El profesional recibe una solicitud.
- Puede aceptar o rechazar.
- El cliente recibe el resultado.
- La solicitud debe tener un tiempo de expiración configurable.

La configuración puede aplicarse al negocio o a un servicio específico.

## 12.3. Estados de reserva

Implementar:

- PENDING.
- CONFIRMED.
- REJECTED.
- EXPIRED.
- CANCELLED.
- IN_PROGRESS.
- COMPLETED.
- NO_SHOW.

Definir transiciones válidas.

No permitir completar una reserva cancelada.

No permitir confirmar una reserva que ya expiró.

No permitir modificar arbitrariamente los estados desde el frontend.

## 12.4. Acciones del profesional

- Aceptar solicitud.
- Rechazar solicitud.
- Cancelar reserva.
- Reprogramar.
- Marcar llegada.
- Iniciar atención.
- Completar servicio.
- Marcar inasistencia.
- Consultar historial.

## 12.5. Acciones del cliente

- Consultar reservas.
- Ver detalles.
- Cancelar según política.
- Solicitar reprogramación.
- Consultar estado.
- Descargar o visualizar comprobante.

## 12.6. Reglas de cancelación

Cada negocio podrá definir:

- Tiempo mínimo para cancelar.
- Penalizaciones informativas.
- Posibilidad de reprogramación.
- Condiciones de devolución.

En la versión local no se realizarán cobros ni devoluciones reales.

## 12.7. Integración con CRM

Cuando una reserva pase a COMPLETED:

- Registrar el servicio en el historial del cliente.
- Asociarlo al negocio.
- Asociarlo al profesional.
- Guardar precio.
- Guardar fecha.
- Guardar observaciones.
- Guardar datos relevantes del servicio.

No registrar una atención solamente por crear o confirmar una reserva.

Evitar duplicados.

---

# 13. PAGOS

El sistema debe soportar pagos presenciales y online.

IMPORTANTE: En esta etapa, toda la funcionalidad debe poder probarse sin credenciales reales.

## 13.1. Métodos de pago

- Pago presencial.
- Pago online.
- Abono.
- Pago completo.
- Pago pendiente.

La configuración debe ser independiente por negocio y, cuando corresponda, por servicio.

## 13.2. Pago presencial

Flujo:

1. Cliente selecciona pago presencial.
2. Reserva se crea.
3. El pago queda pendiente.
4. El profesional realiza la atención.
5. El profesional registra el pago recibido.
6. El sistema actualiza el estado.

## 13.3. Pago online simulado

Implementar un proveedor de pagos local denominado LocalPaymentProvider.

Debe simular:

- Creación de operación.
- Identificador de pago.
- Checkout local.
- Pago aprobado.
- Pago rechazado.
- Pago pendiente.
- Cancelación.
- Reembolso simulado.
- Notificación de pago.
- Consulta de estado.

Crear una interfaz PaymentProvider para permitir incorporar Mercado Pago posteriormente.

El checkout local debe ser una pantalla funcional dentro de la aplicación.

Nunca activar una reserva porque el frontend simplemente informe que un pago fue aprobado.

El backend debe registrar y verificar el resultado de la simulación.

## 13.4. Separación de pagos

Distinguir:

A. Pagos que el cliente realiza al profesional por un servicio.

B. Pagos que el profesional realiza a SalonTrack por una suscripción.

No mezclar ambas operaciones.

## 13.5. Mercado Pago futuro

Dejar preparada la integración para:

- Crear preferencias.
- Redirigir al checkout.
- Procesar webhooks.
- Verificar pagos mediante API.
- Validar firmas.
- Evitar duplicados.
- Procesar reembolsos.

No implementar dependencia obligatoria de Mercado Pago en el entorno local.

No utilizar claves ficticias para simular pagos reales.

---

# 14. PANEL DEL CLIENTE

Crear un espacio denominado Mi cuenta.

Secciones:

## Mi perfil

- Datos personales.
- Fotografía.
- Teléfono.
- Preferencias.
- Ubicación.

## Mis reservas

- Próximas.
- Pendientes.
- Confirmadas.
- Canceladas.
- Completadas.

## Favoritos

- Negocios guardados.
- Profesionales favoritos.
- Servicios favoritos.

## Historial

- Reservas anteriores.
- Servicios realizados.
- Pagos.
- Comprobantes.

## Reseñas

- Reseñas pendientes.
- Reseñas publicadas.
- Respuestas del profesional.

## Notificaciones

- Solicitudes.
- Confirmaciones.
- Rechazos.
- Recordatorios.
- Cancelaciones.
- Pagos.

---

# 15. PANEL DEL PROFESIONAL

Crear una experiencia profesional completa.

## 15.1. Dashboard

Indicadores:

- Reservas de hoy.
- Próximas reservas.
- Solicitudes pendientes.
- Reservas confirmadas.
- Servicios completados.
- Ingresos del período.
- Pagos pendientes.
- Clientes nuevos.
- Clientes recurrentes.
- Calificación promedio.

## 15.2. Agenda

Vistas:

- Día.
- Semana.
- Mes.

Funciones:

- Consultar reservas.
- Crear reserva manual.
- Editar reserva.
- Reprogramar.
- Cancelar.
- Bloquear horarios.
- Cambiar disponibilidad.
- Filtrar por profesional.

## 15.3. Reservas

Filtros:

- Pendientes.
- Confirmadas.
- En curso.
- Completadas.
- Canceladas.
- Rechazadas.
- Inasistencias.

## 15.4. Clientes

Mantener el CRM existente y evolucionarlo.

Incluir:

- Nombre.
- Teléfono.
- Correo.
- Historial.
- Última atención.
- Próxima cita.
- Servicios realizados.
- Gasto acumulado.
- Observaciones.
- Preferencias.
- Contactos.
- Estado de re-engagement.

Distinguir clientes provenientes del marketplace de clientes registrados manualmente.

## 15.5. Ingresos

Mostrar:

- Ingresos diarios.
- Ingresos semanales.
- Ingresos mensuales.
- Ingresos por profesional.
- Ingresos por servicio.
- Pagos presenciales.
- Pagos online.
- Pagos pendientes.
- Cancelaciones.

Los ingresos deben calcularse a partir de operaciones válidas y no de reservas pendientes.

## 15.6. Catálogo

Administración de servicios.

## 15.7. Equipo

Administración de trabajadores y permisos.

## 15.8. Configuración

- Perfil.
- Ubicación.
- Horarios.
- Disponibilidad.
- Reservas.
- Pagos.
- Cancelaciones.
- Notificaciones.
- Publicación.

---

# 16. RESEÑAS Y REPUTACIÓN

Implementar un sistema de evaluaciones.

Reglas:

- Solo puede reseñar quien tenga una reserva COMPLETED.
- Una reserva permite una reseña.
- Escala de 1 a 5 estrellas.
- Comentario opcional.
- Fecha.
- Servicio asociado.
- Profesional asociado.
- Negocio asociado.

El profesional puede responder.

El administrador puede moderar reseñas denunciadas.

Mostrar:

- Promedio.
- Total de reseñas.
- Distribución de estrellas.
- Comentarios recientes.

No permitir reseñas ficticias ni modificar directamente las calificaciones desde el frontend.

---

# 17. NOTIFICACIONES

Implementar un centro de notificaciones interno completamente funcional.

Eventos:

- Nueva reserva.
- Solicitud pendiente.
- Reserva aceptada.
- Reserva rechazada.
- Reserva cancelada.
- Reserva reprogramada.
- Recordatorio.
- Pago aprobado.
- Pago rechazado.
- Servicio completado.
- Reseña recibida.
- Respuesta a reseña.

Cada notificación debe tener:

- Usuario destinatario.
- Tipo.
- Título.
- Mensaje.
- Fecha.
- Estado leído/no leído.
- Referencia a la entidad relacionada.

## 17.1. Simulación local

Implementar notificaciones dentro de la aplicación.

Para email y WhatsApp:

- Crear adaptadores.
- Crear plantillas.
- Crear registros de envío.
- Permitir simular el resultado.
- Mostrar el contenido generado.
- Registrar fallos simulados.

No afirmar que se envió un email o WhatsApp real cuando solo se generó una simulación.

## 17.2. WhatsApp

Preparar integración futura con proveedor oficial.

Mantener también enlaces wa.me con mensajes precompletados.

No implementar automatizaciones no autorizadas.

---

# 18. SISTEMA DE FAVORITOS Y DESCUBRIMIENTO

Permitir que el cliente:

- Guarde negocios.
- Guarde profesionales.
- Consulte favoritos.
- Elimine favoritos.
- Consulte negocios visitados recientemente.

Las recomendaciones iniciales pueden basarse en:

- Categorías consultadas.
- Ubicación.
- Favoritos.
- Servicios visitados.

No es necesario incorporar inteligencia artificial externa en esta etapa.

---

# 19. ADMINISTRACIÓN GENERAL DE SALONTRACK

Crear un panel independiente de administración.

Acceso restringido al rol PLATFORM_ADMIN.

Módulos:

## Usuarios

- Listar.
- Buscar.
- Consultar.
- Suspender.
- Reactivar.

## Negocios

- Listar.
- Revisar.
- Aprobar.
- Suspender.
- Reactivar.
- Consultar actividad.

## Categorías

- Crear.
- Editar.
- Desactivar.
- Ordenar.

## Servicios

- Consultar publicaciones.
- Moderar.
- Desactivar publicaciones.

## Reservas

- Consultar.
- Filtrar.
- Investigar incidencias.

## Reseñas

- Consultar denuncias.
- Moderar.
- Resolver reportes.

## Suscripciones

- Consultar planes.
- Consultar estados.
- Consultar pagos de SalonTrack.

## Métricas

- Usuarios registrados.
- Negocios publicados.
- Profesionales activos.
- Reservas.
- Servicios populares.
- Categorías populares.
- Conversión del marketplace.

## Configuración general

- Datos de la plataforma.
- Políticas.
- Categorías.
- Parámetros generales.
- Modo de desarrollo.

No permitir que el panel administrativo pueda consultar contraseñas ni secretos.

---

# 20. SUSCRIPCIONES Y MONETIZACIÓN

Mantener el modelo comercial existente, pero preparar una evolución de planes.

La suscripción del profesional debe ser independiente de los pagos de sus clientes.

Planes sugeridos:

## Gratis

- Crear perfil.
- Publicar servicios.
- Recibir reservas.
- Agenda básica.
- CRM básico.
- Estadísticas básicas.

## Profesional

- Agenda avanzada.
- CRM completo.
- Recordatorios.
- Estadísticas avanzadas.
- Gestión de clientes.
- Gestión de servicios ampliada.

## Negocio

- Varios profesionales.
- Administración de equipo.
- Permisos.
- Estadísticas por trabajador.
- Gestión avanzada de agenda.
- Herramientas de administración.

La configuración de límites debe estar centralizada.

No codificar restricciones comerciales directamente en componentes visuales.

En local, implementar activación de planes de prueba mediante un proveedor de suscripción simulado.

No requerir Mercado Pago.

---

# 21. MODELO DE DATOS

Diseñar el modelo relacional completo.

Entidades mínimas:

## Identidad

- users.
- user_profiles.
- user_roles.
- sessions.

## Negocios

- businesses.
- business_members.
- business_locations.
- business_hours.
- business_settings.

## Profesionales

- staff.
- staff_services.
- staff_availability.
- availability_blocks.

## Catálogo

- categories.
- subcategories.
- services.
- service_images.

## Reservas

- bookings.
- booking_items.
- booking_status_history.

## Pagos

- payments.
- payment_events.
- refunds.

## CRM

- clients.
- client_service_history.
- contact_logs.

## Reputación

- reviews.
- review_responses.
- review_reports.

## Comunicación

- notifications.
- notification_templates.
- notification_delivery_logs.

## Marketplace

- favorites.
- search_history.

## Comercial

- subscription_plans.
- subscriptions.
- subscription_payments.

## Administración

- audit_logs.
- platform_settings.

## Reglas de integridad

- Utilizar UUID o identificadores únicos equivalentes.
- Crear claves foráneas.
- Crear índices.
- Aplicar restricciones.
- Registrar fechas.
- Evitar duplicados.
- Mantener referencias históricas.
- Definir borrado lógico cuando corresponda.
- Mantener trazabilidad de cambios críticos.

Las tablas existentes deben analizarse antes de migrar.

No crear una segunda tabla para una entidad que ya exista y pueda evolucionar.

---

# 22. SEGURIDAD

Implementar:

- Hash de contraseñas.
- JWT con secretos configurados correctamente.
- Validación de entrada.
- Autorización por roles.
- Autorización por negocio.
- Protección contra IDOR.
- Consultas parametrizadas.
- Protección de datos personales.
- Manejo centralizado de errores.
- Rate limiting en operaciones sensibles.
- Validación de archivos.
- Límites de carga.
- Registro de auditoría.
- Validación backend de precios.
- Validación backend de disponibilidad.
- Idempotencia en reservas y pagos.
- Control de transacciones.

No confiar en datos críticos enviados por el frontend.

Nunca aceptar como definitivo un precio enviado por el navegador: obtenerlo desde el catálogo persistido.

No permitir que un usuario modifique el estado de pago de una operación.

No permitir que un negocio acceda a información de otro negocio.

---

# 23. EXPERIENCIA DE USUARIO Y DISEÑO

Mantener la identidad visual existente de SalonTrack.

La nueva experiencia debe sentirse como un único producto, no como aplicaciones independientes pegadas entre sí.

## 23.1. Experiencia pública

Debe priorizar:

- Descubrimiento.
- Búsqueda.
- Ubicación.
- Categorías.
- Fotografías.
- Precios.
- Disponibilidad.
- Reservas.

## 23.2. Experiencia profesional

Debe priorizar:

- Agenda.
- Clientes.
- Reservas.
- Ingresos.
- Servicios.
- Equipo.

## 23.3. Experiencia móvil

Diseñar primero considerando dispositivos móviles.

Requisitos:

- Navegación intuitiva.
- Botones accesibles.
- Formularios simples.
- Calendario adaptable.
- Tarjetas legibles.
- Modales adecuados.
- Menús responsivos.
- Estados de carga.
- Estados vacíos.
- Mensajes de error.

## 23.4. Accesibilidad

- Contraste adecuado.
- Etiquetas.
- Navegación por teclado.
- Foco visible.
- Textos comprensibles.
- Controles accesibles.

---

# 24. PWA

Conservar la PWA existente.

Verificar:

- Instalación.
- Manifest.
- Iconos.
- Service Worker.
- Estrategia de caché.
- Actualizaciones.
- Funcionamiento responsive.

Las operaciones que requieren confirmación del servidor no deben mostrarse como completadas cuando el dispositivo está sin conexión.

No almacenar información privada sensible en cachés públicas.

---

# 25. MODO LOCAL: REQUISITO FUNDAMENTAL

Este proyecto debe poder ejecutarse y probarse completamente en local.

No se debe necesitar:

- Mercado Pago.
- Cuenta de Google Maps.
- API Key de geolocalización.
- Cuenta de Resend.
- Cuenta de WhatsApp Business.
- Servicio externo de notificaciones.
- Base de datos contratada.
- Credenciales de producción.
- Dominio público.

## 25.1. Persistencia local

SQLite debe almacenar todos los datos.

Cerrar y volver a iniciar el servidor no debe borrar información.

## 25.2. Proveedores simulados

Implementar:

- LocalPaymentProvider.
- LocalEmailProvider.
- LocalWhatsAppProvider.
- LocalNotificationProvider.
- LocalGeolocationProvider o adaptador equivalente.

Cada proveedor debe tener una interfaz común con su futura integración real.

## 25.3. Geolocalización local

Utilizar las coordenadas del navegador cuando estén disponibles.

Permitir seleccionar ubicación manual.

Permitir ingresar coordenadas de prueba para los negocios.

Calcular distancias localmente mediante el backend.

No depender de geocodificación externa para probar búsquedas.

## 25.4. Datos de demostración

Crear un comando o mecanismo controlado para cargar datos de prueba.

Debe incluir:

- Clientes.
- Profesionales.
- Negocios.
- Servicios.
- Categorías.
- Horarios.
- Reservas.
- Pagos simulados.
- Reseñas.

Incluir ejemplos de peluquería, barbería, manicure, estética y masajes.

Los datos de demostración no deben mezclarse accidentalmente con los datos reales.

Debe existir una opción para limpiar y volver a cargar únicamente los datos demo.

## 25.5. Checkout local

Crear una pantalla de pago simulado.

Permitir probar:

- Aprobar pago.
- Rechazar pago.
- Dejar pendiente.
- Cancelar operación.

Registrar cada resultado en SQLite.

## 25.6. Notificaciones locales

Permitir consultar todas las notificaciones generadas.

Simular email y WhatsApp.

Mostrar las plantillas y los resultados de envío.

---

# 26. MIGRACIÓN DE LA VERSIÓN ACTUAL

Antes de modificar el almacenamiento:

1. Crear respaldo del JSON actual.
2. Inspeccionar la estructura real.
3. Identificar todos los modelos.
4. Crear el esquema SQLite.
5. Implementar migración de usuarios.
6. Implementar migración de perfiles.
7. Migrar clientes.
8. Migrar servicios e historial.
9. Migrar registros de contacto.
10. Migrar suscripciones.
11. Migrar pagos.
12. Validar cantidad de registros.
13. Validar relaciones.
14. Ejecutar pruebas.
15. Mantener mecanismo de recuperación.

No eliminar el JSON original hasta confirmar que la migración terminó correctamente.

La migración debe poder ejecutarse más de una vez sin duplicar registros.

Mantener compatibilidad con los endpoints existentes cuando sea posible.

---

# 27. API REST

Organizar las rutas por dominio.

Rutas sugeridas:

## Autenticación

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Negocios

- GET /api/businesses
- POST /api/businesses
- GET /api/businesses/:id
- PATCH /api/businesses/:id
- POST /api/businesses/:id/publish

## Catálogo

- GET /api/categories
- POST /api/categories
- GET /api/services
- POST /api/services
- PATCH /api/services/:id
- DELETE /api/services/:id

## Marketplace

- GET /api/marketplace/search
- GET /api/marketplace/featured
- GET /api/marketplace/nearby
- GET /api/marketplace/categories

## Profesionales

- GET /api/businesses/:id/staff
- POST /api/businesses/:id/staff
- PATCH /api/staff/:id

## Disponibilidad

- GET /api/availability
- POST /api/availability/blocks
- DELETE /api/availability/blocks/:id

## Reservas

- POST /api/bookings
- GET /api/bookings
- GET /api/bookings/:id
- POST /api/bookings/:id/confirm
- POST /api/bookings/:id/reject
- POST /api/bookings/:id/cancel
- POST /api/bookings/:id/reschedule
- POST /api/bookings/:id/start
- POST /api/bookings/:id/complete
- POST /api/bookings/:id/no-show

## Pagos

- POST /api/payments/create
- GET /api/payments/:id
- POST /api/payments/:id/simulate
- POST /api/payments/:id/refund

## CRM

- GET /api/clients
- POST /api/clients
- GET /api/clients/:id
- GET /api/clients/:id/history

## Reseñas

- POST /api/reviews
- GET /api/businesses/:id/reviews
- POST /api/reviews/:id/respond
- POST /api/reviews/:id/report

## Favoritos

- GET /api/favorites
- POST /api/favorites
- DELETE /api/favorites/:id

## Notificaciones

- GET /api/notifications
- PATCH /api/notifications/:id/read
- PATCH /api/notifications/read-all

## Administración

- GET /api/admin/dashboard
- GET /api/admin/users
- GET /api/admin/businesses
- GET /api/admin/bookings
- GET /api/admin/reviews
- GET /api/admin/audit-logs

Las rutas son una propuesta inicial: revisar las existentes y evitar duplicarlas.

Definir DTOs, validaciones y contratos consistentes.

Utilizar códigos HTTP adecuados.

---

# 28. ESTRUCTURA DE NAVEGACIÓN

## Sitio público

- Inicio.
- Explorar.
- Categorías.
- Negocios.
- Profesionales.
- Iniciar sesión.
- Registrarse.

## Cliente autenticado

- Mi cuenta.
- Mis reservas.
- Favoritos.
- Historial.
- Notificaciones.
- Perfil.

## Profesional

- Dashboard.
- Mi negocio.
- Mi perfil público.
- Servicios.
- Equipo.
- Agenda.
- Reservas.
- Clientes.
- Historial.
- Ingresos.
- Reseñas.
- Notificaciones.
- Configuración.

## Administrador

- Dashboard.
- Usuarios.
- Negocios.
- Categorías.
- Servicios.
- Reservas.
- Reseñas.
- Suscripciones.
- Auditoría.
- Configuración.

La navegación debe adaptarse a los roles y permisos del usuario.

---

# 29. ROADMAP DE IMPLEMENTACIÓN POR FASES

La implementación debe seguir este orden.

## FASE 0 — Auditoría y protección de lo existente

Objetivos:

- Revisar el repositorio.
- Crear respaldo.
- Identificar dependencias.
- Revisar rutas.
- Revisar modelos.
- Identificar funcionalidades reutilizables.
- Documentar riesgos.

Criterios de aceptación:

- La aplicación actual sigue ejecutándose.
- Las funcionalidades existentes siguen disponibles.
- Existe respaldo verificable.
- Existe un plan de migración.

## FASE 1 — Persistencia y arquitectura

Objetivos:

- Introducir SQLite.
- Crear migraciones.
- Crear repositorios.
- Migrar datos existentes.
- Incorporar transacciones.
- Centralizar validaciones.
- Centralizar errores.
- Mejorar autenticación.
- Preparar adaptadores.

Criterios de aceptación:

- Los datos persisten después de reiniciar.
- Los registros migrados se conservan.
- No hay duplicados.
- Los endpoints existentes funcionan.
- Las operaciones transaccionales están cubiertas por pruebas.

## FASE 2 — Usuarios, roles y negocios

Objetivos:

- Implementar roles.
- Implementar perfiles.
- Crear negocios.
- Crear miembros.
- Implementar permisos.
- Implementar publicación.

Criterios de aceptación:

- Un usuario puede ser cliente y profesional.
- Un negocio puede tener varios trabajadores.
- Los permisos se aplican correctamente.
- Los negocios tienen estados de publicación.
- No hay acceso cruzado entre negocios.

## FASE 3 — Categorías y servicios

Objetivos:

- Crear categorías.
- Crear subcategorías.
- Crear catálogo.
- Crear servicios.
- Implementar precios.
- Implementar modalidades.
- Implementar imágenes.
- Asignar servicios a trabajadores.

Criterios de aceptación:

- Un profesional puede publicar servicios.
- Los precios y duraciones se guardan.
- Las categorías son administrables.
- Los servicios publicados aparecen en su perfil público.

## FASE 4 — Agenda y disponibilidad

Objetivos:

- Horarios del negocio.
- Horarios individuales.
- Descansos.
- Bloqueos.
- Buffers.
- Cálculo de disponibilidad.
- Validación de solapamientos.

Criterios de aceptación:

- Los horarios se calculan correctamente.
- No se ofrecen horas fuera de jornada.
- Se consideran reservas existentes.
- Se consideran bloqueos.
- No se producen dobles reservas.

## FASE 5 — Marketplace

Objetivos:

- Página de exploración.
- Buscador.
- Filtros.
- Ordenamiento.
- Ubicación.
- Distancias.
- Vista de mapa local.
- Perfiles públicos.
- Favoritos.

Criterios de aceptación:

- El cliente encuentra negocios.
- Los filtros se combinan.
- Las distancias se calculan correctamente.
- Los perfiles muestran información publicada.
- La búsqueda funciona sin API Keys externas.

## FASE 6 — Reservas

Objetivos:

- Flujo de reservas.
- Confirmación automática.
- Confirmación manual.
- Rechazo.
- Cancelación.
- Reprogramación.
- Expiración.
- Historial.
- Integración con CRM.

Criterios de aceptación:

- Un cliente puede reservar.
- Un profesional puede administrar sus solicitudes.
- El estado se actualiza correctamente.
- No se generan dobles reservas.
- Los servicios completados se registran en CRM.

## FASE 7 — Pagos locales

Objetivos:

- Interfaz de pagos.
- Checkout local.
- Simulación de estados.
- Registro de operaciones.
- Pago presencial.
- Abonos.
- Pago completo.
- Reembolsos simulados.

Criterios de aceptación:

- El pago aprobado se registra.
- El pago rechazado no se considera aprobado.
- El estado de pago es persistente.
- Los pagos no se duplican.
- Los pagos de reservas no se mezclan con las suscripciones.

## FASE 8 — Paneles y estadísticas

Objetivos:

- Dashboard profesional.
- Panel cliente.
- Panel administrador.
- Estadísticas.
- Ingresos.
- Clientes.
- Reservas.

Criterios de aceptación:

- Cada panel muestra datos reales de SQLite.
- Los cálculos son correctos.
- Los usuarios solo ven su información autorizada.

## FASE 9 — Notificaciones y reputación

Objetivos:

- Notificaciones internas.
- Plantillas.
- Simulación de email.
- Simulación de WhatsApp.
- Reseñas.
- Respuestas.
- Moderación.

Criterios de aceptación:

- Los eventos generan notificaciones.
- Las notificaciones son persistentes.
- Solo clientes elegibles pueden reseñar.
- Las reseñas aparecen correctamente.

## FASE 10 — Suscripciones y monetización

Objetivos:

- Planes.
- Límites.
- Funciones por plan.
- Simulación de pagos de suscripción.
- Administración de licencias.

Criterios de aceptación:

- Los planes se aplican correctamente.
- Los límites se validan en backend.
- Las suscripciones son independientes de las reservas.
- El entorno local no necesita pagos externos.

## FASE 11 — Calidad y estabilización

Objetivos:

- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de autorización.
- Pruebas de concurrencia.
- Pruebas end-to-end.
- Responsive.
- Accesibilidad.
- Manejo de errores.
- Documentación.
- Preparación de producción.

Criterios de aceptación:

- Todos los módulos funcionan en conjunto.
- No hay errores críticos.
- Las operaciones principales están cubiertas.
- La aplicación puede ejecutarse localmente desde cero.

---

# 30. PLAN DE PRUEBAS OBLIGATORIO

No basta con que las pantallas se vean bien.

Debes comprobar el comportamiento real.

## Autenticación

- Registro exitoso.
- Correo duplicado.
- Inicio de sesión.
- Contraseña incorrecta.
- Cierre de sesión.
- Permisos.

## Negocios

- Crear negocio.
- Editar negocio.
- Publicar negocio.
- Suspender negocio.
- Agregar trabajador.
- Asignar permisos.

## Servicios

- Crear servicio.
- Editar precio.
- Cambiar duración.
- Desactivar servicio.
- Asignar trabajador.

## Marketplace

- Buscar por nombre.
- Buscar por categoría.
- Filtrar por precio.
- Filtrar por distancia.
- Filtrar por disponibilidad.
- Ordenar resultados.
- Consultar perfil público.

## Reservas

- Reserva automática.
- Reserva manual.
- Aceptación.
- Rechazo.
- Cancelación.
- Reprogramación.
- Expiración.
- Doble reserva.
- Solicitudes simultáneas.

## Pagos

- Pago aprobado.
- Pago rechazado.
- Pago pendiente.
- Pago presencial.
- Abono.
- Reembolso simulado.
- Duplicidad de operaciones.

## CRM

- Cliente creado desde reserva.
- Servicio completado.
- Historial.
- Re-engagement.
- Ausencia de duplicados.

## Seguridad

- Acceso a negocio ajeno.
- Acceso a reserva ajena.
- Modificación de precio desde frontend.
- Modificación fraudulenta de estado.
- Usuario sin permisos.
- Acceso administrativo no autorizado.

## Persistencia

- Reinicio del backend.
- Reinicio del frontend.
- Cierre de sesión.
- Recuperación de datos.
- Restauración de backup.

---

# 31. EXPERIENCIA DEMO LOCAL

Crear un entorno de demostración controlado.

Debe permitir ingresar con cuentas de prueba para verificar las diferentes experiencias.

Crear, como mínimo:

- Una cuenta de administrador.
- Una cuenta de cliente.
- Una cuenta de profesional independiente.
- Una cuenta de propietario de salón.
- Una cuenta de trabajador.

Crear negocios de demostración en distintas categorías y ubicaciones de ejemplo de Chile.

Incluir servicios, horarios, reservas y reseñas.

Documentar las credenciales exclusivamente en la documentación local de desarrollo.

No utilizar estas credenciales como cuentas reales de producción.

Crear un comando para cargar datos de demostración y otro para reiniciarlos.

---

# 32. VARIABLES DE ENTORNO

Crear un `.env.example` documentado.

Variables sugeridas:

NODE_ENV=development

PORT=3000

APP_URL=http://localhost:3000

JWT_SECRET=replace_for_local_development

DATABASE_FILE=./data/salontrack.sqlite

PAYMENT_PROVIDER=local

EMAIL_PROVIDER=local

WHATSAPP_PROVIDER=local

MAP_PROVIDER=local

SEED_DEMO_DATA=true

Las variables reales de producción nunca deben incluirse en el repositorio.

El sistema debe iniciar correctamente sin credenciales externas.

---

# 33. COMANDOS Y DOCUMENTACIÓN

Mantener comandos simples.

Como mínimo:

npm install

npm run dev

npm run build

npm run test

npm run lint

Crear comandos adicionales si son necesarios:

npm run db:migrate

npm run db:seed

npm run db:reset

npm run db:backup

npm run db:restore

Documentar:

- Requisitos.
- Instalación.
- Inicio local.
- Migraciones.
- Datos demo.
- Cuentas de prueba.
- Pruebas.
- Variables.
- Respaldo.
- Restauración.
- Estructura del proyecto.

---

# 34. REGLAS PARA LA EJECUCIÓN DEL PROYECTO

El agente debe trabajar de forma incremental.

No debe intentar implementar todo en una única modificación descontrolada.

Debe:

1. Analizar el código.
2. Crear un plan concreto.
3. Implementar una fase.
4. Ejecutar pruebas.
5. Corregir errores.
6. Verificar compatibilidad.
7. Actualizar documentación.
8. Continuar con la siguiente fase.

No marcar una fase como terminada si sus criterios de aceptación no se cumplen.

No reemplazar funcionalidades existentes por pantallas estáticas.

No crear botones que no ejecuten ninguna acción.

No dejar formularios que solo simulen guardar información.

No almacenar los datos principales exclusivamente en memoria o localStorage.

No confiar en datos enviados por el frontend.

No introducir API Keys ficticias.

No declarar integraciones reales cuando solo exista una simulación.

No sacrificar seguridad para simplificar las pruebas locales.

No eliminar pruebas existentes para hacer pasar una implementación.

No duplicar lógica de negocio entre frontend y backend.

Toda regla importante debe estar centralizada en el backend.

---

# 35. RESULTADO FINAL ESPERADO

SalonTrack 2.0 debe ser una plataforma completamente operativa que permita:

### Como cliente

- Registrarme.
- Buscar negocios.
- Buscar profesionales.
- Buscar servicios.
- Encontrar profesionales cercanos.
- Aplicar filtros.
- Consultar mapas y perfiles.
- Comparar precios.
- Revisar calificaciones.
- Guardar favoritos.
- Reservar.
- Pagar de forma simulada.
- Cancelar o solicitar reprogramación.
- Consultar historial.
- Calificar servicios.

### Como profesional

- Registrarme.
- Crear mi negocio.
- Publicar mis servicios.
- Configurar precios.
- Administrar trabajadores.
- Configurar agenda.
- Recibir reservas.
- Confirmar o rechazar.
- Gestionar clientes.
- Registrar atenciones.
- Gestionar pagos.
- Consultar ingresos.
- Recibir notificaciones.
- Administrar reseñas.
- Gestionar mi perfil público.

### Como administrador

- Administrar usuarios.
- Administrar negocios.
- Administrar categorías.
- Moderar publicaciones.
- Consultar reservas.
- Administrar reseñas.
- Administrar planes.
- Consultar métricas.
- Gestionar incidencias.

### Como plataforma

- Mantener datos persistentes.
- Controlar permisos.
- Evitar reservas duplicadas.
- Registrar operaciones.
- Mantener trazabilidad.
- Funcionar sin servicios externos.
- Estar preparada para integraciones reales.
- Permitir migración a PostgreSQL.
- Permitir escalar a múltiples categorías y negocios.

---

# 36. INSTRUCCIÓN FINAL DE EJECUCIÓN

Comienza inspeccionando el repositorio actual de SalonTrack.

Tu primera tarea es producir un inventario técnico de lo que existe, identificar las diferencias respecto a este roadmap y determinar las modificaciones necesarias.

Después, implementa las fases en el orden definido.

Prioriza siempre la integridad de los datos y el funcionamiento real.

No construyas una maqueta visual.

No simules persistencia.

No omitas el backend.

No dejes funcionalidades críticas como botones decorativos.

El producto debe poder ejecutarse y probarse completamente en local, desde el registro de usuarios hasta la publicación de servicios, búsqueda de profesionales, reservas, confirmaciones, pagos simulados, gestión de clientes y administración.

Cuando una fase esté terminada, entrega un resumen de:

- Funcionalidades implementadas.
- Archivos creados o modificados.
- Migraciones realizadas.
- Endpoints creados.
- Pruebas ejecutadas.
- Resultado de las pruebas.
- Pendientes.
- Riesgos detectados.

**La prioridad absoluta es entregar un SalonTrack 2.0 funcional, coherente, seguro y persistente en local. Las integraciones externas y la configuración de producción se realizarán en una etapa posterior, sin tener que rediseñar el producto.**