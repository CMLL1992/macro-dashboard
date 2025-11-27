# 🚀 Guía Completa: Activación de Pipeline de Noticias y Telegram

**Fecha:** 13 de Noviembre de 2025

Esta guía te ayudará a activar:
1. ✅ Pipeline de noticias (GitHub Actions)
2. ✅ Notificaciones Telegram (Vercel)

---

## 📋 Paso 1: Configurar Notificaciones Telegram

### 1.1 Crear un Bot de Telegram

1. Abre Telegram y busca **`@BotFather`**
2. Envía el comando: `/newbot`
3. Sigue las instrucciones:
   - Nombre del bot: `CM11 Trading Bot` (o el que prefieras)
   - Username del bot: `cm11_trading_bot` (debe terminar en `bot`)
4. **Copia el token** que te proporciona (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
   - ⚠️ **Guarda este token de forma segura**, lo necesitarás en el siguiente paso

### 1.2 Obtener tu Chat ID

**Opción A: Chat privado (recomendado para empezar)**

1. Envía un mensaje a tu bot (cualquier mensaje, por ejemplo: `/start`)
2. Abre en tu navegador: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   - Reemplaza `<TU_TOKEN>` con el token que obtuviste en el paso anterior
3. Busca en la respuesta JSON el campo `"chat":{"id":`
4. El número después de `"id":` es tu **Chat ID** (puede ser positivo o negativo)
   - Ejemplo: `"chat":{"id":123456789` → Tu Chat ID es `123456789`

**Opción B: Usar @userinfobot (más fácil)**

1. Busca `@userinfobot` en Telegram
2. Envía `/start`
3. Te mostrará tu User ID (este es tu Chat ID para chats privados)

### 1.3 Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto: **macro-dashboard-with-data**
3. Ve a **Settings** → **Environment Variables**
4. Añade las siguientes variables:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
ENABLE_TELEGRAM_NOTIFICATIONS=true

# Opcional: Para pruebas
TELEGRAM_TEST_CHAT_ID=tu_test_chat_id_aqui
ENABLE_TELEGRAM_TESTS=false
```

**Variables a añadir:**

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot | Token que obtuviste de @BotFather |
| `TELEGRAM_CHAT_ID` | Tu Chat ID | ID de tu chat privado o grupo |
| `ENABLE_TELEGRAM_NOTIFICATIONS` | `true` | Habilita las notificaciones |
| `TELEGRAM_TEST_CHAT_ID` | (opcional) | Chat ID para pruebas |
| `ENABLE_TELEGRAM_TESTS` | `false` | Desactiva modo test en producción |

5. **Importante:** Selecciona los entornos donde aplicar:
   - ✅ **Production**
   - ✅ **Preview** (opcional)
   - ✅ **Development** (opcional)

6. Haz clic en **Save**

7. **Redeploy** tu aplicación para que los cambios surtan efecto:
   - Ve a **Deployments**
   - Haz clic en los 3 puntos del último deployment
   - Selecciona **Redeploy**

### 1.4 Verificar Telegram

Una vez desplegado, puedes verificar que funciona:

```bash
# Verificar estado
curl https://macro-dashboard-seven.vercel.app/api/notifications/verify

# O desde el navegador
https://macro-dashboard-seven.vercel.app/api/notifications/verify
```

Deberías ver un mensaje indicando que Telegram está configurado correctamente.

---

## 📋 Paso 2: Activar Pipeline de Noticias

### 2.1 Obtener FRED API Key (Opcional pero Recomendado)

1. Ve a: https://fred.stlouisfed.org/docs/api/api_key.html
2. Regístrate (es **gratuito**)
3. Copia tu API Key

### 2.2 Generar INGEST_KEY

Necesitas una clave secreta para autenticar las peticiones de ingesta. Puedes generar una aleatoria:

```bash
# En tu terminal (macOS/Linux)
openssl rand -hex 32

# O usar un generador online
# https://www.random.org/strings/
```

**Ejemplo de INGEST_KEY generada:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2.3 Configurar Secrets en GitHub

1. Ve a tu repositorio en GitHub: https://github.com/CMLL1992/macro-dashboard
2. Ve a **Settings** → **Secrets and variables** → **Actions**
3. Haz clic en **New repository secret**
4. Añade los siguientes secrets:

**Secret 1: APP_URL**
- Name: `APP_URL`
- Value: `https://macro-dashboard-seven.vercel.app`
- Haz clic en **Add secret**

**Secret 2: INGEST_KEY**
- Name: `INGEST_KEY`
- Value: La clave que generaste en el paso 2.2
- Haz clic en **Add secret**

**Secret 3: FRED_API_KEY** (Opcional pero recomendado)
- Name: `FRED_API_KEY`
- Value: Tu API key de FRED
- Haz clic en **Add secret**

### 2.4 Configurar INGEST_KEY en Vercel

**IMPORTANTE:** La misma `INGEST_KEY` debe estar en Vercel para que las peticiones funcionen.

1. Ve a Vercel → Tu proyecto → **Settings** → **Environment Variables**
2. Añade:
   - Name: `INGEST_KEY`
   - Value: La misma clave que usaste en GitHub
   - Entornos: ✅ Production, ✅ Preview, ✅ Development
3. Haz clic en **Save**
4. **Redeploy** tu aplicación

### 2.5 Activar el Workflow en GitHub Actions

1. Ve a tu repositorio → pestaña **Actions**
2. Busca el workflow **"News & Calendar Ingest (All Sources)"**
3. Verifica que esté habilitado (debería estar activo por defecto)
4. (Opcional) Haz clic en **Run workflow** → **Run workflow** para probar manualmente

### 2.6 Verificar que Funciona

1. Espera 1-2 minutos después de ejecutar el workflow
2. Ve a tu aplicación: https://macro-dashboard-seven.vercel.app/noticias
3. Deberías ver:
   - Noticias recientes (si hay noticias macro relevantes)
   - Eventos del calendario de la próxima semana
4. Verifica en Telegram que recibes notificaciones cuando hay noticias nuevas

---

## ✅ Checklist de Verificación

### Telegram ✅
- [ ] Bot creado en @BotFather
- [ ] Token copiado y guardado
- [ ] Chat ID obtenido
- [ ] Variables configuradas en Vercel:
  - [ ] `TELEGRAM_BOT_TOKEN`
  - [ ] `TELEGRAM_CHAT_ID`
  - [ ] `ENABLE_TELEGRAM_NOTIFICATIONS=true`
- [ ] Aplicación redeployada en Vercel
- [ ] Verificación exitosa: `/api/notifications/verify`

### Pipeline de Noticias ✅
- [ ] FRED API Key obtenida (opcional)
- [ ] INGEST_KEY generada
- [ ] Secrets configurados en GitHub:
  - [ ] `APP_URL`
  - [ ] `INGEST_KEY`
  - [ ] `FRED_API_KEY` (opcional)
- [ ] `INGEST_KEY` configurada en Vercel
- [ ] Aplicación redeployada en Vercel
- [ ] Workflow activado en GitHub Actions
- [ ] Prueba manual ejecutada (opcional)

---

## 🧪 Pruebas Manuales

### Probar Notificaciones Telegram

```bash
# Desde tu terminal local
curl -X POST https://macro-dashboard-seven.vercel.app/api/alerts/test \
  -H "Authorization: Bearer tu_cron_token"
```

O desde el panel de admin:
1. Ve a: https://macro-dashboard-seven.vercel.app/admin
2. Usa las herramientas de prueba de notificaciones

### Probar Pipeline de Noticias Localmente

```bash
# Configurar variables
export APP_URL=https://macro-dashboard-seven.vercel.app
export INGEST_KEY=tu_ingest_key_aqui
export FRED_API_KEY=tu_fred_key_aqui

# Ejecutar script de noticias
pnpm tsx scripts/ingest-news-rss.ts

# Ejecutar script de calendario
pnpm tsx scripts/ingest-calendar-fred.ts
```

---

## 🔍 Solución de Problemas

### Telegram no funciona

**Error: "MISSING_TELEGRAM_TOKEN"**
- Verifica que `TELEGRAM_BOT_TOKEN` esté configurado en Vercel
- Verifica que la aplicación haya sido redeployada después de añadir la variable

**Error: "MISSING_TELEGRAM_CHAT_ID"**
- Verifica que `TELEGRAM_CHAT_ID` esté configurado
- Asegúrate de haber enviado un mensaje a tu bot primero
- Verifica el Chat ID usando: `https://api.telegram.org/bot<TOKEN>/getUpdates`

**Error: "chat not found"**
- Envía `/start` a tu bot en Telegram
- Verifica que el Chat ID sea correcto
- Si es un grupo, asegúrate de que el bot sea administrador

### Pipeline de noticias no funciona

**Error: "Unauthorized"**
- Verifica que `INGEST_KEY` sea la misma en GitHub y Vercel
- Verifica que el header `X-INGEST-KEY` se esté enviando correctamente

**Error: "Workflow failed"**
- Revisa los logs en GitHub Actions
- Verifica que todos los secrets estén configurados
- Verifica que `APP_URL` sea correcta

**No aparecen noticias**
- Es normal si no hay noticias macro relevantes en las últimas 24 horas
- El script solo procesa noticias de alto/medio impacto
- Verifica los logs del workflow para ver qué está pasando

---

## 📊 Monitoreo

### Ver Logs de GitHub Actions

1. Ve a tu repositorio → **Actions**
2. Haz clic en el último run de **"News & Calendar Ingest"**
3. Revisa los logs de cada step

### Ver Notificaciones Enviadas

1. Ve a: https://macro-dashboard-seven.vercel.app/admin
2. Revisa la sección de notificaciones
3. O consulta directamente: `/api/notifications/history`

### Ver Noticias Insertadas

1. Ve a: https://macro-dashboard-seven.vercel.app/noticias
2. O consulta directamente: `/api/admin/news/recent`

---

## 🎉 ¡Listo!

Una vez completados estos pasos:

✅ **Notificaciones Telegram** funcionando automáticamente
✅ **Pipeline de noticias** ejecutándose cada 6 horas
✅ **Calendario económico** actualizándose automáticamente

El sistema ahora:
- Recolecta noticias de Bloomberg, Reuters, Financial Times
- Obtiene eventos del calendario desde FRED
- Envía notificaciones automáticas a Telegram
- Actualiza las páginas de noticias y calendario

---

**Última actualización:** 2025-11-13





