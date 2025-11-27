# ⚡ Resumen Rápido: Activación de Noticias y Telegram

## 🎯 Objetivo
Activar el pipeline de noticias y las notificaciones de Telegram en 10 minutos.

---

## 📱 PASO 1: Telegram (5 minutos)

### 1. Crear Bot
1. Abre Telegram → Busca `@BotFather`
2. Envía `/newbot` y sigue instrucciones
3. **Copia el token** (formato: `123456789:ABC...`)

### 2. Obtener Chat ID
1. Envía `/start` a tu bot
2. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
3. Busca `"chat":{"id":` → **Copia el número**

### 3. Configurar en Vercel
1. Ve a: https://vercel.com/dashboard → Tu proyecto → Settings → Environment Variables
2. Añade:
   ```
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   TELEGRAM_CHAT_ID=tu_chat_id_aqui
   ENABLE_TELEGRAM_NOTIFICATIONS=true
   ```
3. **Redeploy** (Deployments → 3 puntos → Redeploy)

---

## 📰 PASO 2: Pipeline de Noticias (5 minutos)

### 1. Generar INGEST_KEY
```bash
openssl rand -hex 32
```
**Copia la clave generada**

### 2. Configurar en GitHub
1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Añade secrets:
   - `APP_URL` = `https://macro-dashboard-seven.vercel.app`
   - `INGEST_KEY` = (la clave que generaste)
   - `FRED_API_KEY` = (opcional, obtener en https://fred.stlouisfed.org/docs/api/api_key.html)

### 3. Configurar en Vercel
1. Ve a Vercel → Settings → Environment Variables
2. Añade:
   ```
   INGEST_KEY=la_misma_clave_que_en_github
   ```
3. **Redeploy**

### 4. Activar Workflow
1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Busca "News & Calendar Ingest"
3. Haz clic en "Run workflow" para probar

---

## ✅ Verificación

### Telegram
```bash
curl https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

### Pipeline
1. Espera 2 minutos después de ejecutar el workflow
2. Ve a: https://macro-dashboard-seven.vercel.app/noticias
3. Deberías ver noticias/eventos

---

## 🆘 Problemas Comunes

**Telegram no funciona:**
- Verifica que hayas redeployado después de añadir variables
- Verifica que hayas enviado `/start` a tu bot

**Pipeline no funciona:**
- Verifica que `INGEST_KEY` sea la misma en GitHub y Vercel
- Revisa los logs en GitHub Actions

---

## 📖 Guía Completa

Para más detalles, consulta: **GUIA-ACTIVACION-COMPLETA.md**





