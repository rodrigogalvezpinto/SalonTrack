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

Para correr todas las pruebas automatizadas:

```bash
npm test
```

Salida esperada:
```
🧪 Iniciando Suite de Pruebas Automatizadas de SalonTrack Chile...

  ✅ [PASS] Formato CLP: Enteros con separador de miles en punto, sin decimales
  ✅ [PASS] Formato de Fechas: Estándar chileno DD/MM/AAAA
  ✅ [PASS] Formato de Teléfono Chileno: +56 9 XXXX XXXX
  ✅ [PASS] Enlace de WhatsApp: Codificación y número internacional chileno
  ✅ [PASS] Personalización de plantilla WhatsApp: Reemplaza tags {nombre}, {salon}, {servicio}
  ✅ [PASS] Autenticación Segura: Hash bcrypt y verificación de contraseñas
  ✅ [PASS] Aislamiento de Datos (RLS): Un estilista no puede ver datos de otro estilista
  ✅ [PASS] Cálculo de Retoque: Fecha exacta sumando días recomendados
  ✅ [PASS] Módulo Re-engagement: Filtra correctamente clientas inactivas hace más de 90 días
  ✅ [PASS] Licencia y Pagos: Extensión correcta de días y prevención de duplicados

---------------------------------------
Resultados de pruebas: 10 aprobadas, 0 fallidas.
🎉 Todas las pruebas pasaron satisfactoriamente.
```

---

## 3. Pruebas de Compilación y Tipado

```bash
npm run lint
npm run build
```
Ambas herramientas validan que no existan errores de sintaxis, tipos incompatibles o módulos faltantes.
