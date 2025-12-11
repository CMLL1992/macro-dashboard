# 🔧 Checklist para dejar CM11 Trading en producción 100% autónoma

Este documento contiene el checklist completo para asegurar que el dashboard funcione 24/7 sin necesidad de que tu ordenador esté encendido.

---

## ✅ 1. Revisar proyecto en Vercel

### 1.1. Confirmar conexión con GitHub
- [ ] Ve a Vercel Dashboard → Tu proyecto
- [ ] Verifica que está conectado al repositorio correcto de GitHub
- [ ] Confirma que la rama de producción es `main` (o la que uses)
- [ ] Verifica que los deployments automáticos están activados

### 1.2. Obtener URL de producción
- [ ] Anota la URL de producción (ej: `https://macro-dashboard.vercel.app` o tu dominio personalizado)
- [ ] Esta será la URL que usarás desde móvil/tablet/PC
- [ ] Opcional: Configura un dominio personalizado si lo prefieres

**URL de producción:** `___________________________`

---

## ✅ 2. Variables de entorno en Vercel

Ve a **Vercel Dashboard → Settings → Environment Variables** y verifica que TODAS estas variables estén configuradas:

### Variables críticas (obligatorias)

- [ ] **`TURSO_DATABASE_URL`**
  - Formato: `libsql://tu-proyecto.aws-eu-west-1.turso.io`
  - Sin esto, la BD no funcionará en producción

- [ ] **`TURSO_AUTH_TOKEN`**
  - Token de autenticación de Turso
  - Sin esto, no se puede conectar a Turso

- [ ] **`FRED_API_KEY`**
  - Tu API key de FRED (ej: `ccc90330e6a50afa217fb55ac48c4d28`)
  - Sin esto, no se pueden ingerir datos de FRED

- [ ] **`CRON_TOKEN`**
  - Token secreto para proteger los endpoints de jobs
  - Debe ser el mismo que usas en local

### Variables opcionales pero recomendadas

- [ ] **`TELEGRAM_BOT_TOKEN`**
  - Token del bot de Telegram
  - Necesario para notificaciones

- [ ] **`TELEGRAM_CHAT_ID`** o **`TELEGRAM_TEST_CHAT_ID`**
  - ID del chat donde recibir notificaciones
  - Necesario para notificaciones

- [ ] **`ENABLE_TELEGRAM_NOTIFICATIONS`**
  - Valor: `"true"` (con comillas) si quieres notificaciones activas
  - Valor: `"false"` o no configurar si no quieres notificaciones

- [ ] **`APP_URL`** (opcional pero recomendado)
  - URL completa de producción (ej: `https://macro-dashboard.vercel.app`)
  - Útil para construir URLs absolutas en notificaciones

- [ ] **`INGEST_KEY`** (si lo usas)
  - Token adicional para protección de endpoints de ingesta

### Verificar configuración

Después de configurar las variables:

1. Ve a **Vercel Dashboard → Settings → Environment Variables**
2. Verifica que todas las variables críticas estén marcadas como **"Production"**
3. Haz clic en **"Redeploy"** para aplicar los cambios

---

## ✅ 3. Base de datos (Turso)

### 3.1. Verificar que se usa Turso en producción

El código ya está configurado para usar Turso automáticamente si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados.

**Verificación automática:**
- [ ] El código en `lib/db/unified-db.ts` detecta Turso automáticamente
- [ ] Si las variables están configuradas, usa Turso
- [ ] Si no están configuradas, usa SQLite local (solo en desarrollo)

### 3.2. Aplicar migraciones en Turso

Si has añadido nuevas columnas (como `notified_at`, `notify_lead_minutes`), verifica que estén en Turso:

**Opción A: Migración automática**
- [ ] El código en `lib/db/unified-db.ts` intenta aplicar migraciones automáticamente
- [ ] Revisa los logs de Vercel después del primer deploy para ver si hay errores de migración

**Opción B: Migración manual (si es necesario)**
```sql
-- Conectarte a Turso y ejecutar:
ALTER TABLE economic_events ADD COLUMN notified_at TEXT NULL;
ALTER TABLE economic_events ADD COLUMN notify_lead_minutes INTEGER DEFAULT 30;
```

### 3.3. Verificar datos en Turso

- [ ] Accede a tu dashboard de Turso
- [ ] Verifica que las tablas principales existen:
  - `macro_series`
  - `macro_observations`
  - `economic_events`
  - `correlations`
- [ ] Verifica que hay datos recientes (no está vacía)

---

## ✅ 4. Jobs automáticos en Vercel (Cron Jobs)

Los cron jobs permiten que los datos se actualicen automáticamente sin tu intervención.

### 4.1. Configurar Cron Jobs en Vercel

Ve a **Vercel Dashboard → Settings → Cron Jobs** y añade estos jobs:

#### Job 1: Ingesta FRED
- **Schedule:** `0 6 * * *` (diario a las 06:00 UTC)
- **Path:** `/api/jobs/ingest/fred`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```
  (o deja vacío si solo usas localhost)

#### Job 2: Ingesta Europea/ECB
- **Schedule:** `0 7 * * *` (diario a las 07:00 UTC, después de FRED)
- **Path:** `/api/jobs/ingest/european`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```

#### Job 3: Ingesta Calendario
- **Schedule:** `0 8 * * *` (diario a las 08:00 UTC)
- **Path:** `/api/jobs/ingest/calendar`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```

#### Job 4: Cálculo de Correlaciones
- **Schedule:** `0 9 * * *` (diario a las 09:00 UTC, después de las ingestas)
- **Path:** `/api/jobs/correlations`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```

#### Job 5: Cálculo de Sesgos
- **Schedule:** `0 10 * * *` (diario a las 10:00 UTC, después de correlaciones)
- **Path:** `/api/jobs/compute/bias`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```

#### Job 6 (Opcional): Notificaciones de Calendario
- **Schedule:** `*/5 * * * *` (cada 5 minutos)
- **Path:** `/api/jobs/notify/calendar`
- **Method:** `POST`
- **Headers:** 
  ```
  Authorization: Bearer ${CRON_TOKEN}
  ```
- **Nota:** Solo activar si quieres notificaciones de Telegram activas

### 4.2. Alternativa: Usar vercel.json

Si prefieres configurar los cron jobs en código, añade esto a `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/ingest/fred",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/jobs/ingest/european",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/jobs/ingest/calendar",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/jobs/correlations",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/jobs/compute/bias",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/jobs/notify/calendar",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**⚠️ Importante:** Si usas `vercel.json`, los headers de autorización deben manejarse dentro del código del endpoint usando `CRON_TOKEN`.

---

## ✅ 5. Comprobación desde producción

### 5.1. Verificar páginas principales

Abre la URL de producción en tu navegador y verifica:

- [ ] **`/dashboard`** - Debe mostrar datos recientes
- [ ] **`/correlaciones`** - Debe mostrar correlaciones actualizadas
- [ ] **`/sesgos`** - Debe mostrar sesgos tácticos
- [ ] **`/calendario`** - Debe mostrar eventos próximos
- [ ] **`/analisis`** - Debe mostrar análisis diario

### 5.2. Verificar datos

- [ ] Las fechas de los indicadores son recientes (no de hace meses)
- [ ] Los valores coinciden con los datos oficiales (FRED, ECB, etc.)
- [ ] No hay errores en la consola del navegador
- [ ] Las páginas cargan sin errores 500 o 404

### 5.3. Verificar endpoints de diagnóstico

- [ ] **`/api/status/health`** - Debe devolver `{ "status": "ok" }`
- [ ] **`/api/diag`** - Debe mostrar información del sistema
- [ ] **`/api/status/jobs`** - Debe mostrar estado de los últimos jobs

### 5.4. Verificar base de datos

- [ ] En los logs de Vercel, busca mensajes como:
  ```
  [db] getUnifiedDB() - Using Turso database
  ```
- [ ] NO debe aparecer:
  ```
  [db] Using better-sqlite3 (local)
  ```
  (a menos que estés en desarrollo local)

---

## ✅ 6. Telegram en producción

### 6.1. Verificar configuración

- [ ] `TELEGRAM_BOT_TOKEN` está configurado en Vercel
- [ ] `TELEGRAM_CHAT_ID` o `TELEGRAM_TEST_CHAT_ID` está configurado
- [ ] `ENABLE_TELEGRAM_NOTIFICATIONS` está en `"true"` si quieres notificaciones activas

### 6.2. Probar notificaciones desde producción

- [ ] Ve a `/api/test/notifications` o `/api/notifications/test` en producción
- [ ] Ejecuta una prueba de envío
- [ ] Verifica que recibes el mensaje en Telegram
- [ ] Si no funciona, revisa los logs de Vercel para ver el error

### 6.3. Verificar URLs en notificaciones

- [ ] Si las notificaciones incluyen enlaces, deben apuntar a la URL de producción
- [ ] NO deben apuntar a `http://localhost:3000`
- [ ] Si es necesario, configura `APP_URL` en Vercel

---

## ✅ 7. Verificación final

### 7.1. Checklist rápido

- [ ] ✅ Proyecto conectado a GitHub correcto
- [ ] ✅ URL de producción funcionando
- [ ] ✅ Todas las variables de entorno configuradas
- [ ] ✅ Base de datos Turso conectada y con datos
- [ ] ✅ Cron jobs configurados y ejecutándose
- [ ] ✅ Páginas principales funcionan correctamente
- [ ] ✅ Datos son recientes y correctos
- [ ] ✅ Telegram configurado (si aplica)

### 7.2. Prueba de autonomía

**Prueba final:** Apaga tu ordenador y verifica:

1. [ ] Abre la URL de producción desde otro dispositivo (móvil, tablet, otro PC)
2. [ ] Verifica que todas las páginas cargan correctamente
3. [ ] Verifica que los datos son recientes
4. [ ] Espera 24 horas y verifica que los datos se actualizaron automáticamente (los cron jobs funcionaron)

Si todo esto funciona, **¡tu dashboard está 100% autónomo!** 🎉

---

## 🐛 Troubleshooting

### Problema: Los datos no se actualizan

**Solución:**
1. Verifica que los cron jobs están configurados en Vercel
2. Revisa los logs de Vercel para ver si hay errores
3. Verifica que `CRON_TOKEN` está configurado correctamente
4. Verifica que `FRED_API_KEY` y otras API keys están configuradas

### Problema: La base de datos está vacía

**Solución:**
1. Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados
2. Ejecuta manualmente los jobs de ingesta desde la URL de producción:
   ```
   POST https://TU_URL/api/jobs/ingest/fred
   POST https://TU_URL/api/jobs/ingest/european
   POST https://TU_URL/api/jobs/ingest/calendar
   ```
3. Verifica que los datos se guardaron en Turso

### Problema: Las notificaciones de Telegram no funcionan

**Solución:**
1. Verifica que `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están configurados
2. Verifica que `ENABLE_TELEGRAM_NOTIFICATIONS` está en `"true"`
3. Prueba enviando un mensaje manual desde `/api/test/notifications`
4. Revisa los logs de Vercel para ver el error específico

### Problema: Los cron jobs no se ejecutan

**Solución:**
1. Verifica que los cron jobs están configurados en Vercel Dashboard
2. Verifica que el schedule está en formato correcto (cron syntax)
3. Verifica que el path es correcto (debe empezar con `/api/...`)
4. Revisa los logs de Vercel para ver si hay errores de autenticación

---

## 📝 Notas importantes

1. **Variables de entorno:** Las variables configuradas en Vercel solo se aplican después de un redeploy. Si añades nuevas variables, haz clic en "Redeploy" en el último deployment.

2. **Cron jobs:** Los cron jobs en Vercel tienen un límite de ejecuciones gratuitas. Verifica tu plan de Vercel para asegurarte de que tienes suficiente cuota.

3. **Base de datos Turso:** Turso tiene un límite de requests por segundo en el plan gratuito. Si tienes muchos usuarios simultáneos, considera actualizar el plan.

4. **Telegram:** El bot de Telegram debe estar activo y el chat ID debe ser correcto. Puedes verificar el chat ID usando `@userinfobot` en Telegram.

---

## 🚀 Una vez completado el checklist

Tu dashboard estará funcionando 24/7 de forma completamente autónoma:

- ✅ Frontend y API en Vercel (siempre disponible)
- ✅ Base de datos en Turso (siempre disponible)
- ✅ Jobs automáticos ejecutándose diariamente
- ✅ Notificaciones de Telegram (si están activadas)
- ✅ Accesible desde cualquier dispositivo con internet

**¡Ya no necesitas tener tu ordenador encendido para que el dashboard funcione!** 🎉


