# 🎯 Pasos Finales para Activar Todo

**Fecha:** 13 de Noviembre de 2025

## ✅ Lo que Ya Tienes Configurado

Según tu información:
- ✅ `TELEGRAM_BOT_TOKEN` en Vercel
- ✅ `TELEGRAM_CHAT_ID` en Vercel
- ✅ `INGEST_KEY` en Vercel
- ✅ `APP_URL` en Vercel
- ✅ `FRED_API_KEY` en Vercel
- ✅ Secrets en GitHub (APP_URL, INGEST_KEY, FRED_API_KEY)

---

## ⚠️ Problema Detectado

El script de verificación muestra que **Telegram no se está verificando correctamente**. Esto puede ser porque:

1. **La aplicación no ha sido redeployada** después de añadir las variables
2. **Falta la variable `ENABLE_TELEGRAM_NOTIFICATIONS=true`**
3. **Hay un problema con los valores de las variables**

---

## 🔧 Pasos para Solucionar

### PASO 1: Verificar Variables en Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto: **macro-dashboard-with-data**
3. Ve a **Settings** → **Environment Variables**
4. Verifica que existan estas variables **exactamente así**:

```
TELEGRAM_BOT_TOKEN = (tu token)
TELEGRAM_CHAT_ID = (tu chat id)
ENABLE_TELEGRAM_NOTIFICATIONS = true
INGEST_KEY = (tu clave)
APP_URL = https://macro-dashboard-seven.vercel.app
FRED_API_KEY = (tu key)
```

**Importante:**
- `ENABLE_TELEGRAM_NOTIFICATIONS` debe ser exactamente `true` (no `"true"`, no `True`)
- Todas deben estar marcadas para **Production** ✅

### PASO 2: Redeployar la Aplicación

**CRÍTICO:** Después de añadir/modificar variables, debes redeployar:

1. En Vercel, ve a **Deployments**
2. Haz clic en los **3 puntos** (⋯) del último deployment
3. Selecciona **Redeploy**
4. Espera a que termine el deploy (1-2 minutos)

### PASO 3: Verificar Telegram

Después del redeploy, verifica:

```bash
curl https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

O visita en el navegador:
```
https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

**Resultado esperado:**
```json
{
  "telegram": {
    "valid": true,
    "bot_ok": true,
    "chat_ok": true
  }
}
```

Si aún no funciona:
- Verifica que hayas enviado `/start` a tu bot en Telegram
- Verifica el Chat ID usando: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`

### PASO 4: Verificar GitHub Secrets

1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Verifica que existan estos secrets:
   - ✅ `APP_URL` = `https://macro-dashboard-seven.vercel.app`
   - ✅ `INGEST_KEY` = (debe ser la MISMA que en Vercel)
   - ✅ `FRED_API_KEY` = (tu API key de FRED)

**IMPORTANTE:** `INGEST_KEY` debe ser **exactamente la misma** en GitHub y Vercel.

### PASO 5: Activar y Probar el Workflow

1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Busca el workflow **"News & Calendar Ingest (All Sources)"**
3. Haz clic en **"Run workflow"** → **"Run workflow"**
4. Espera 1-2 minutos
5. Haz clic en el run que acabas de ejecutar
6. Revisa los logs para ver si hay errores

**Si hay errores:**
- Revisa que los secrets estén correctos
- Verifica que `APP_URL` sea exactamente `https://macro-dashboard-seven.vercel.app`
- Verifica que `INGEST_KEY` sea la misma que en Vercel

### PASO 6: Verificar que Funciona End-to-End

**A. Verificar que aparecen noticias:**

Espera 2-3 minutos después de ejecutar el workflow, luego:

```bash
curl https://macro-dashboard-seven.vercel.app/api/admin/news/recent
```

O visita: https://macro-dashboard-seven.vercel.app/noticias

**B. Verificar que recibes notificaciones:**

Si el workflow insertó noticias nuevas, deberías recibir una notificación en Telegram.

**C. Verificar eventos del calendario:**

```bash
curl https://macro-dashboard-seven.vercel.app/api/admin/calendar/recent
```

O visita: https://macro-dashboard-seven.vercel.app/noticias (muestra eventos de próxima semana)

---

## ✅ Checklist Final

Antes de considerar que todo funciona:

- [ ] Variables verificadas en Vercel (todas presentes y correctas)
- [ ] `ENABLE_TELEGRAM_NOTIFICATIONS=true` está en Vercel
- [ ] Aplicación redeployada en Vercel
- [ ] Telegram verificado: `/api/notifications/verify` devuelve `valid: true`
- [ ] Secrets verificados en GitHub (APP_URL, INGEST_KEY, FRED_API_KEY)
- [ ] `INGEST_KEY` es la misma en GitHub y Vercel
- [ ] Workflow ejecutado manualmente y exitoso
- [ ] Noticias aparecen en `/noticias`
- [ ] Eventos aparecen en `/noticias`
- [ ] Recibiste notificación en Telegram (si hay noticias nuevas)

---

## 🧪 Script de Verificación

Ejecuta este script para verificar todo automáticamente:

```bash
pnpm tsx scripts/verificar-estado-completo.ts
```

Este script te dirá exactamente qué está funcionando y qué falta.

---

## 🆘 Si Algo No Funciona

### Telegram no funciona después del redeploy:

1. Verifica que `ENABLE_TELEGRAM_NOTIFICATIONS=true` (exactamente `true`, no string)
2. Verifica que el token y chat ID sean correctos
3. Envía `/start` a tu bot
4. Verifica el Chat ID: `https://api.telegram.org/bot<TOKEN>/getUpdates`

### Workflow falla:

1. Revisa los logs en GitHub Actions
2. Verifica que los secrets estén correctos
3. Verifica que `INGEST_KEY` sea la misma en GitHub y Vercel
4. Verifica que `APP_URL` sea exactamente `https://macro-dashboard-seven.vercel.app`

### No aparecen noticias:

- Es normal si no hay noticias macro relevantes en las últimas 24 horas
- El script solo procesa noticias de alto/medio impacto
- Revisa los logs del workflow para ver qué está pasando

---

## 📊 Monitoreo Continuo

Una vez que todo funciona:

1. **El workflow se ejecuta automáticamente cada 6 horas**
2. **Recibirás notificaciones en Telegram** cuando haya noticias nuevas
3. **El weekly ahead se envía los domingos** a las 17:00 UTC

Puedes verificar el estado en cualquier momento ejecutando:
```bash
pnpm tsx scripts/verificar-estado-completo.ts
```

---

**Última actualización:** 2025-11-13





