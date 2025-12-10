# 🔧 Checklist para dejar CM11 Trading en producción 100% autónoma

## Objetivo

Asegurar que el dashboard funcione 24/7 sin necesidad de que el ordenador del usuario esté encendido. Todo debe funcionar desde Vercel + Turso.

---

## ✅ 1. Revisar proyecto en Vercel

- [ ] Confirmar que el proyecto está conectado al repo de GitHub correcto (rama `main`)
- [ ] Anotar la URL de producción (ej: `https://macro-dashboard.vercel.app`)
- [ ] Esa URL será la que el usuario use desde móvil/PC

---

## ✅ 2. Variables de entorno en Vercel

Ve a **Vercel Dashboard → Settings → Environment Variables** y verifica que TODAS estas estén configuradas:

### Variables OBLIGATORIAS:

- [ ] **`TURSO_DATABASE_URL`** - URL de la base de datos Turso
- [ ] **`TURSO_AUTH_TOKEN`** - Token de autenticación de Turso
- [ ] **`FRED_API_KEY`** - API key de FRED (ej: `ccc90330e6a50afa217fb55ac48c4d28`)
- [ ] **`CRON_TOKEN`** - Token para proteger endpoints de jobs

### Variables OPCIONALES:

- [ ] **`TELEGRAM_BOT_TOKEN`** - Token del bot de Telegram
- [ ] **`TELEGRAM_CHAT_ID`** - ID del chat para notificaciones
- [ ] **`ENABLE_TELEGRAM_NOTIFICATIONS`** - `"true"` si quieres notificaciones activas
- [ ] **`APP_URL`** - URL de producción (ej: `https://macro-dashboard.vercel.app`)

**⚠️ IMPORTANTE:** Después de añadir/modificar variables, haz clic en **"Redeploy"** para aplicar los cambios.

---

## ✅ 3. Base de datos

### Verificar que se usa Turso en producción

El código en `lib/db/unified-db.ts` detecta automáticamente Turso si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados.

**Verificación:**
- [ ] En producción, el código usa Turso automáticamente (no SQLite local)
- [ ] Si las variables están configuradas, `isUsingTurso()` devuelve `true`
- [ ] Las migraciones se aplican automáticamente al inicializar el schema

### Aplicar migraciones si es necesario

Si has añadido nuevas columnas (como `notified_at`, `notify_lead_minutes` en `economic_events`):

- [ ] El código intenta aplicar migraciones automáticamente
- [ ] Revisa los logs de Vercel después del primer deploy para ver si hay errores
- [ ] Si hay errores, ejecuta manualmente las migraciones en Turso

---

## ✅ 4. Jobs automáticos en Vercel (Cron Jobs)

Los cron jobs permiten que los datos se actualicen automáticamente sin intervención.

### Opción A: Configurar en Vercel Dashboard

Ve a **Vercel Dashboard → Settings → Cron Jobs** y añade:

1. **Ingesta FRED**
   - Schedule: `0 6 * * *` (diario a las 06:00 UTC)
   - Path: `/api/jobs/ingest/fred`
   - Method: `POST`

2. **Ingesta Europea/ECB**
   - Schedule: `0 7 * * *` (diario a las 07:00 UTC)
   - Path: `/api/jobs/ingest/european`
   - Method: `POST`

3. **Ingesta Calendario**
   - Schedule: `0 8 * * *` (diario a las 08:00 UTC)
   - Path: `/api/jobs/ingest/calendar`
   - Method: `POST`

4. **Cálculo de Correlaciones**
   - Schedule: `0 9 * * *` (diario a las 09:00 UTC)
   - Path: `/api/jobs/correlations`
   - Method: `POST`

5. **Cálculo de Sesgos**
   - Schedule: `0 10 * * *` (diario a las 10:00 UTC)
   - Path: `/api/jobs/compute/bias`
   - Method: `POST`

6. **Notificaciones de Calendario** (opcional)
   - Schedule: `*/5 * * * *` (cada 5 minutos)
   - Path: `/api/jobs/notify/calendar`
   - Method: `POST`

**Nota:** Los headers de autorización (`CRON_TOKEN`) se manejan dentro del código del endpoint.

### Opción B: Usar vercel.json (ya configurado)

El archivo `vercel.json` ya tiene los cron jobs configurados. Solo verifica que estén correctos:

- [ ] Los paths coinciden con los endpoints reales
- [ ] Los schedules son razonables (no demasiado frecuentes)
- [ ] Después de hacer push a GitHub, Vercel aplicará los cron jobs automáticamente

---

## ✅ 5. Comprobación desde producción

### Verificar páginas principales

Abre la URL de producción y verifica:

- [ ] `/dashboard` - Muestra datos recientes
- [ ] `/correlaciones` - Muestra correlaciones actualizadas
- [ ] `/sesgos` - Muestra sesgos tácticos
- [ ] `/calendario` - Muestra eventos próximos

### Verificar datos

- [ ] Las fechas de los indicadores son recientes (no de hace meses)
- [ ] Los valores coinciden con los datos oficiales
- [ ] No hay errores en la consola del navegador

### Verificar endpoints de diagnóstico

- [ ] `/api/status/health` - Devuelve `{ "status": "ok" }`
- [ ] `/api/diag` - Muestra información del sistema
- [ ] Verifica en los logs que se está usando Turso (no SQLite local)

---

## ✅ 6. Telegram en producción (si aplica)

- [ ] `TELEGRAM_BOT_TOKEN` configurado en Vercel
- [ ] `TELEGRAM_CHAT_ID` configurado en Vercel
- [ ] `ENABLE_TELEGRAM_NOTIFICATIONS` = `"true"` si quieres notificaciones activas
- [ ] Probar envío de mensaje desde `/api/test/notifications` en producción
- [ ] Verificar que las URLs en notificaciones apuntan a producción (no localhost)

---

## ✅ 7. Verificación final

### Checklist rápido

- [ ] ✅ Proyecto conectado a GitHub correcto
- [ ] ✅ URL de producción funcionando
- [ ] ✅ Todas las variables de entorno configuradas
- [ ] ✅ Base de datos Turso conectada y con datos
- [ ] ✅ Cron jobs configurados y ejecutándose
- [ ] ✅ Páginas principales funcionan correctamente
- [ ] ✅ Datos son recientes y correctos
- [ ] ✅ Telegram configurado (si aplica)

### Prueba de autonomía

**Prueba final:** Apaga el ordenador del usuario y verifica:

1. [ ] Abre la URL de producción desde otro dispositivo (móvil, tablet, otro PC)
2. [ ] Verifica que todas las páginas cargan correctamente
3. [ ] Verifica que los datos son recientes
4. [ ] Espera 24 horas y verifica que los datos se actualizaron automáticamente

Si todo esto funciona, **¡el dashboard está 100% autónomo!** 🎉

---

## 🐛 Troubleshooting

### Los datos no se actualizan

1. Verifica que los cron jobs están configurados en Vercel
2. Revisa los logs de Vercel para ver si hay errores
3. Verifica que `CRON_TOKEN` está configurado correctamente
4. Verifica que `FRED_API_KEY` y otras API keys están configuradas

### La base de datos está vacía

1. Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados
2. Ejecuta manualmente los jobs de ingesta desde la URL de producción
3. Verifica que los datos se guardaron en Turso

### Las notificaciones de Telegram no funcionan

1. Verifica que `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están configurados
2. Verifica que `ENABLE_TELEGRAM_NOTIFICATIONS` está en `"true"`
3. Prueba enviando un mensaje manual desde `/api/test/notifications`
4. Revisa los logs de Vercel para ver el error específico

---

## 📝 Notas importantes

1. **Variables de entorno:** Las variables configuradas en Vercel solo se aplican después de un redeploy. Si añades nuevas variables, haz clic en "Redeploy".

2. **Cron jobs:** Los cron jobs en Vercel tienen un límite de ejecuciones gratuitas. Verifica tu plan de Vercel.

3. **Base de datos Turso:** Turso tiene un límite de requests por segundo en el plan gratuito. Si tienes muchos usuarios simultáneos, considera actualizar el plan.

---

## 🚀 Resultado final

Una vez completado este checklist:

- ✅ Frontend y API en Vercel (siempre disponible)
- ✅ Base de datos en Turso (siempre disponible)
- ✅ Jobs automáticos ejecutándose diariamente
- ✅ Notificaciones de Telegram (si están activadas)
- ✅ Accesible desde cualquier dispositivo con internet

**¡El dashboard funcionará 24/7 sin necesidad de tener el ordenador encendido!** 🎉

---

## 🔒 8. Seguridad y protección de endpoints

### Protección de endpoints de jobs

Todos los endpoints de jobs deben estar protegidos con `CRON_TOKEN`:

- [ ] Verificar que `/api/jobs/*` requieren `CRON_TOKEN` en el header
- [ ] El token debe coincidir con la variable de entorno `CRON_TOKEN`
- [ ] Los cron jobs de Vercel deben incluir el header `Authorization: Bearer {CRON_TOKEN}`

### Verificación de seguridad

- [ ] Los endpoints de jobs no son accesibles públicamente sin token
- [ ] Las variables de entorno sensibles no están expuestas en el código
- [ ] Las API keys están configuradas solo en Vercel (no en el código)

---

## 📊 9. Monitoreo y alertas

### Configurar alertas en Vercel

- [ ] Configurar alertas de errores en Vercel Dashboard
- [ ] Configurar notificaciones por email cuando hay errores críticos
- [ ] Revisar logs periódicamente para detectar problemas

### Monitoreo de jobs

- [ ] Verificar que los cron jobs se ejecutan correctamente
- [ ] Revisar logs de ejecución de jobs en Vercel
- [ ] Verificar que los datos se actualizan según el schedule

### Métricas a monitorear

- [ ] Tiempo de respuesta de la API
- [ ] Tasa de errores en los endpoints
- [ ] Uso de recursos (CPU, memoria)
- [ ] Requests a la base de datos Turso

---

## 🔄 10. Backup y recuperación

### Backup de base de datos

- [ ] Configurar backups automáticos de Turso (si está disponible en tu plan)
- [ ] Documentar el proceso de restauración de backups
- [ ] Probar la restauración de un backup en un entorno de prueba

### Backup de configuración

- [ ] Exportar variables de entorno de Vercel (guardar en lugar seguro)
- [ ] Documentar la configuración de cron jobs
- [ ] Guardar copia de `vercel.json` y otros archivos de configuración

---

## 🧪 11. Testing en producción

### Pruebas de endpoints

Ejecuta manualmente desde la URL de producción para verificar:

- [ ] `POST /api/jobs/ingest/fred` - Devuelve éxito y actualiza datos
- [ ] `POST /api/jobs/ingest/european` - Devuelve éxito y actualiza datos
- [ ] `POST /api/jobs/ingest/calendar` - Devuelve éxito y actualiza datos
- [ ] `POST /api/jobs/correlations` - Calcula correlaciones correctamente
- [ ] `POST /api/jobs/compute/bias` - Calcula sesgos correctamente
- [ ] `POST /api/jobs/notify/calendar` - Envía notificaciones (si está activo)

### Pruebas de carga

- [ ] Verificar que el dashboard carga rápidamente (< 3 segundos)
- [ ] Verificar que múltiples usuarios pueden acceder simultáneamente
- [ ] Verificar que la base de datos responde rápidamente

---

## 📱 12. Acceso móvil y responsive

### Verificación móvil

- [ ] Abrir el dashboard en un dispositivo móvil
- [ ] Verificar que todas las páginas se ven correctamente
- [ ] Verificar que los gráficos se muestran correctamente en móvil
- [ ] Verificar que los botones y enlaces son fáciles de usar en móvil

### PWA (Progressive Web App) - Opcional

- [ ] Verificar si hay configuración de PWA
- [ ] Probar instalación en móvil (si está disponible)
- [ ] Verificar que funciona offline (si está configurado)

---

## 🔧 13. Mantenimiento continuo

### Tareas periódicas

- [ ] **Semanal:** Revisar logs de Vercel para detectar errores
- [ ] **Mensual:** Verificar que los datos se actualizan correctamente
- [ ] **Mensual:** Revisar uso de recursos y límites de Vercel/Turso
- [ ] **Trimestral:** Actualizar dependencias si es necesario

### Actualizaciones

- [ ] Mantener las dependencias actualizadas
- [ ] Probar actualizaciones en un entorno de desarrollo primero
- [ ] Documentar cambios importantes en el código

---

## 📚 14. Documentación adicional

### Documentación para usuarios

- [ ] Crear guía de usuario básica (cómo usar el dashboard)
- [ ] Documentar qué significan los indicadores
- [ ] Documentar cómo interpretar correlaciones y sesgos

### Documentación técnica

- [ ] Documentar la arquitectura del sistema
- [ ] Documentar los endpoints de la API
- [ ] Documentar el esquema de la base de datos
- [ ] Documentar el proceso de deployment

---

## 🎯 15. Optimizaciones futuras

### Mejoras de rendimiento

- [ ] Implementar caché para datos que no cambian frecuentemente
- [ ] Optimizar queries a la base de datos
- [ ] Implementar paginación si hay muchos datos

### Mejoras de funcionalidad

- [ ] Añadir más indicadores económicos
- [ ] Mejorar visualizaciones de datos
- [ ] Añadir más filtros y opciones de búsqueda
- [ ] Implementar exportación de datos (CSV, PDF)

---

## ✅ Checklist final de producción

Antes de considerar el proyecto 100% listo para producción:

- [ ] ✅ Todas las variables de entorno configuradas
- [ ] ✅ Base de datos Turso funcionando
- [ ] ✅ Cron jobs configurados y ejecutándose
- [ ] ✅ Endpoints protegidos con tokens
- [ ] ✅ Pruebas manuales exitosas
- [ ] ✅ Dashboard accesible desde móvil
- [ ] ✅ Sin errores en logs de producción
- [ ] ✅ Datos actualizándose automáticamente
- [ ] ✅ Notificaciones funcionando (si aplica)
- [ ] ✅ Documentación completa
- [ ] ✅ Backup configurado
- [ ] ✅ Monitoreo configurado

**¡Proyecto listo para producción!** 🚀
