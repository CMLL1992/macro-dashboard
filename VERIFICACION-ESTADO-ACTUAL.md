# ✅ Verificación del Estado Actual

**Fecha:** 13 de Noviembre de 2025

## 📋 Estado de Configuración

Según tu información, ya tienes configurado:

### ✅ En Vercel:
- `TELEGRAM_BOT_TOKEN` ✅
- `TELEGRAM_CHAT_ID` ✅
- `INGEST_KEY` ✅
- `APP_URL` ✅
- `FRED_API_KEY` ✅

### ✅ En GitHub (Secrets):
- `APP_URL` ✅
- `INGEST_KEY` ✅
- `FRED_API_KEY` ✅

---

## 🧪 Verificación Rápida

### 1. Verificar Telegram

Ejecuta este comando o visita la URL:

```bash
curl https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

O desde el navegador:
```
https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

**Resultado esperado:**
```json
{
  "telegram": {
    "valid": true,
    "bot_ok": true,
    "chat_ok": true,
    "errors": [],
    "warnings": []
  }
}
```

### 2. Verificar Pipeline de Noticias

**A. Verificar que el workflow esté activo:**

1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Busca el workflow **"News & Calendar Ingest (All Sources)"**
3. Verifica que el último run haya sido exitoso (✅ verde)

**B. Verificar que los secrets estén configurados:**

1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Verifica que existan estos secrets:
   - ✅ `APP_URL` = `https://macro-dashboard-seven.vercel.app`
   - ✅ `INGEST_KEY` = (debe ser la misma que en Vercel)
   - ✅ `FRED_API_KEY` = (tu API key de FRED)

**C. Probar manualmente el workflow:**

1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Selecciona **"News & Calendar Ingest"**
3. Haz clic en **"Run workflow"** → **"Run workflow"**
4. Espera 1-2 minutos
5. Revisa los logs para ver si hay errores

### 3. Verificar que Funciona End-to-End

**A. Verificar noticias:**

```bash
curl https://macro-dashboard-seven.vercel.app/api/admin/news/recent
```

O visita: https://macro-dashboard-seven.vercel.app/noticias

**B. Verificar calendario:**

```bash
curl https://macro-dashboard-seven.vercel.app/api/admin/calendar/recent
```

O visita: https://macro-dashboard-seven.vercel.app/noticias (muestra eventos)

**C. Probar inserción de noticia (requiere INGEST_KEY):**

```bash
# Reemplaza YOUR_INGEST_KEY con tu clave real
curl -X POST https://macro-dashboard-seven.vercel.app/api/news/insert \
  -H "X-INGEST-KEY: YOUR_INGEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente": "test_123",
    "fuente": "Test",
    "pais": "US",
    "tema": "Inflación",
    "titulo": "Test News",
    "impacto": "high",
    "published_at": "2025-11-13T12:00:00Z",
    "valor_publicado": 0.5,
    "valor_esperado": 0.3
  }'
```

**Resultado esperado:**
```json
{
  "success": true,
  "inserted": true,
  "notified": true
}
```

---

## 🔍 Script de Verificación Automática

He creado un script que verifica todo automáticamente:

```bash
pnpm tsx scripts/verificar-estado-completo.ts
```

Este script verifica:
- ✅ Configuración de Telegram
- ✅ INGEST_KEY
- ✅ Endpoints de noticias y calendario
- ✅ Estado del workflow de GitHub

---

## ⚠️ Problemas Comunes y Soluciones

### Problema 1: Telegram no funciona

**Síntomas:**
- El endpoint `/api/notifications/verify` muestra `valid: false`
- No recibes notificaciones

**Solución:**
1. Verifica que las variables estén en Vercel:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ENABLE_TELEGRAM_NOTIFICATIONS=true`
2. **Redeploya** la aplicación (importante después de añadir variables)
3. Verifica que hayas enviado `/start` a tu bot
4. Verifica el Chat ID usando: `https://api.telegram.org/bot<TOKEN>/getUpdates`

### Problema 2: Pipeline de noticias no funciona

**Síntomas:**
- El workflow falla en GitHub Actions
- No aparecen noticias nuevas

**Solución:**
1. Verifica que los secrets en GitHub sean correctos:
   - `APP_URL` debe ser exactamente: `https://macro-dashboard-seven.vercel.app`
   - `INGEST_KEY` debe ser la misma que en Vercel
2. Verifica que `INGEST_KEY` esté en Vercel (la misma clave)
3. Revisa los logs del workflow en GitHub Actions para ver errores específicos
4. Verifica que el workflow esté activo (no deshabilitado)

### Problema 3: "Unauthorized" al insertar noticias

**Síntomas:**
- El endpoint `/api/news/insert` devuelve 401

**Solución:**
1. Verifica que `INGEST_KEY` sea la misma en GitHub y Vercel
2. Verifica que estés enviando el header: `X-INGEST-KEY: tu_clave`
3. Verifica que la clave no tenga espacios o caracteres extra

---

## ✅ Checklist Final

Antes de considerar que todo está funcionando:

- [ ] Telegram verificado: `/api/notifications/verify` devuelve `valid: true`
- [ ] Recibiste una notificación de prueba en Telegram
- [ ] GitHub Workflow ejecutado exitosamente (último run en verde)
- [ ] Secrets configurados en GitHub (APP_URL, INGEST_KEY, FRED_API_KEY)
- [ ] INGEST_KEY configurada en Vercel (misma clave que GitHub)
- [ ] Endpoint de noticias funciona: `/api/admin/news/recent`
- [ ] Endpoint de calendario funciona: `/api/admin/calendar/recent`
- [ ] Puedes insertar una noticia de prueba (con INGEST_KEY)

---

## 🎯 Próximos Pasos

Una vez verificado que todo funciona:

1. **Monitorear el workflow:**
   - Se ejecuta automáticamente cada 6 horas
   - Puedes ver los logs en GitHub Actions

2. **Verificar notificaciones:**
   - Deberías recibir notificaciones cuando hay noticias nuevas
   - Deberías recibir el weekly ahead los domingos

3. **Revisar datos:**
   - Visita `/noticias` para ver noticias y eventos
   - Visita `/admin` para ver estadísticas

---

## 📞 Si Necesitas Ayuda

Si algo no funciona:

1. Ejecuta el script de verificación: `pnpm tsx scripts/verificar-estado-completo.ts`
2. Revisa los logs en GitHub Actions
3. Revisa los logs en Vercel (Deployments → Logs)
4. Verifica las variables de entorno en Vercel

---

**Última actualización:** 2025-11-13





