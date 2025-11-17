# 📋 Lista de Variables de Entorno y Secrets

## 🎯 Propósito

Este documento lista todas las variables de entorno y secrets esperados en el proyecto, **solo con los nombres** (sin valores), para facilitar la verificación.

---

## 🔵 Variables de Entorno en Vercel (Production)

### Variables OBLIGATORIAS

| Variable | Requerida para /api/health | Descripción |
|----------|---------------------------|-------------|
| `FRED_API_KEY` | ❌ No | API key de FRED para obtener datos macroeconómicos |
| `CRON_TOKEN` | ❌ No | Token para autenticar endpoints de jobs (`/api/jobs/*`) |
| `INGEST_KEY` | ❌ No | Clave secreta para endpoints de ingesta (`/api/news/insert`, `/api/calendar/insert`) |
| `APP_URL` | ❌ No | URL base de la aplicación (usado por jobs automatizados) |

### Variables OPCIONALES

| Variable | Requerida para /api/health | Descripción |
|----------|---------------------------|-------------|
| `DATABASE_PATH` | ❌ No | Ruta personalizada de la base de datos (por defecto: `/tmp/macro.db` en Vercel) |
| `TELEGRAM_BOT_TOKEN` | ❌ No | Token del bot de Telegram para notificaciones |
| `TELEGRAM_CHAT_ID` | ❌ No | ID del chat de Telegram para notificaciones |
| `TELEGRAM_TEST_CHAT_ID` | ❌ No | ID del chat de Telegram para pruebas |
| `FMP_API_KEY` | ❌ No | API key de Financial Modeling Prep (para noticias/calendario) |
| `FINNHUB_API_KEY` | ❌ No | API key de Finnhub (para noticias/calendario) |
| `NEWSAPI_KEY` | ❌ No | API key de NewsAPI (para noticias) |
| `TRADING_ECONOMICS_API_KEY` | ❌ No | API key de Trading Economics (para calendario) |

### Variables AUTOMÁTICAS de Vercel (no configurar manualmente)

| Variable | Descripción |
|----------|-------------|
| `VERCEL` | Siempre presente en Vercel (usado para detectar entorno) |
| `VERCEL_ENV` | `production`, `preview`, o `development` |
| `VERCEL_URL` | URL de la instancia actual |

**⚠️ NOTA IMPORTANTE:** El endpoint `/api/health` **NO requiere** ninguna variable de entorno específica. Si falla, es probablemente un problema de:
- Base de datos no accesible
- Tablas no inicializadas
- Error en la inicialización del esquema

---

## 🔴 Secrets en GitHub Actions

### Secrets OBLIGATORIOS

| Secret | Usado por | Descripción |
|--------|-----------|-------------|
| `APP_URL` | Workflows | URL pública de la aplicación en Vercel |
| `CRON_TOKEN` | Workflows | Token para autenticar endpoints de jobs (debe coincidir con Vercel) |
| `INGEST_KEY` | Workflows | Key para autenticar endpoints de ingesta (debe coincidir con Vercel) |
| `FRED_API_KEY` | Workflows | API key de FRED (debe coincidir con Vercel) |

### Secrets OPCIONALES

| Secret | Usado por | Descripción |
|--------|-----------|-------------|
| `NOTIFICATIONS_TEST_BASE_URL` | Test Notifications | URL base para tests de notificaciones |
| `NOTIFICATIONS_TEST_INGEST_KEY` | Test Notifications | Key para autenticar tests de notificaciones |
| `FMP_API_KEY` | News/Calendar Ingest | API key de Financial Modeling Prep |
| `FINNHUB_API_KEY` | News/Calendar Ingest | API key de Finnhub |
| `NEWSAPI_KEY` | News/Calendar Ingest | API key de NewsAPI |
| `TRADING_ECONOMICS_API_KEY` | News/Calendar Ingest | API key de Trading Economics |

**⚠️ CRÍTICO:** Los valores de `APP_URL`, `CRON_TOKEN`, `INGEST_KEY` y `FRED_API_KEY` **DEBEN SER IDÉNTICOS** en Vercel y GitHub. Si no coinciden:
- Los workflows se ejecutarán "exitosamente" en GitHub
- Pero las llamadas a la API devolverán `401 Unauthorized`
- Los datos NO se escribirán en la base de datos

---

## ✅ Checklist de Verificación

### Verificar en Vercel

1. **Accede a Vercel Dashboard:**
   - Ve a: https://vercel.com
   - Selecciona tu proyecto
   - Ve a: **Settings** → **Environment Variables**

2. **Verifica Variables Obligatorias:**
   - [ ] `FRED_API_KEY` existe y está marcada para Production
   - [ ] `CRON_TOKEN` existe y está marcada para Production
   - [ ] `INGEST_KEY` existe y está marcada para Production
   - [ ] `APP_URL` existe y está marcada para Production

3. **Verifica Variables Opcionales (si las usas):**
   - [ ] `TELEGRAM_BOT_TOKEN` (si usas Telegram)
   - [ ] `TELEGRAM_CHAT_ID` (si usas Telegram)
   - [ ] `FMP_API_KEY` (si usas Financial Modeling Prep)
   - [ ] `FINNHUB_API_KEY` (si usas Finnhub)
   - [ ] `NEWSAPI_KEY` (si usas NewsAPI)
   - [ ] `TRADING_ECONOMICS_API_KEY` (si usas Trading Economics)

### Verificar en GitHub

1. **Accede a GitHub:**
   - Ve a: https://github.com/CMLL1992/macro-dashboard
   - Ve a: **Settings** → **Secrets and variables** → **Actions**

2. **Verifica Secrets Obligatorios:**
   - [ ] `APP_URL` existe
   - [ ] `CRON_TOKEN` existe
   - [ ] `INGEST_KEY` existe
   - [ ] `FRED_API_KEY` existe

3. **Verifica Coincidencia de Valores:**
   - ⚠️ **IMPORTANTE:** No puedes ver los valores en GitHub (están ocultos)
   - Debes verificar manualmente que los valores coincidan con Vercel
   - Si no estás seguro, puedes actualizar ambos con el mismo valor

---

## 🔍 Cómo Verificar Valores (sin exponerlos)

### En Vercel

1. Ve a: **Settings** → **Environment Variables**
2. Click en el ojo 👁️ junto a cada variable para ver el valor
3. **NO compartas estos valores públicamente**

### En GitHub

1. Ve a: **Settings** → **Secrets and variables** → **Actions**
2. **NO puedes ver los valores** (están ocultos por seguridad)
3. Solo puedes ver cuándo fueron actualizados
4. Si necesitas verificar, debes actualizar el secret con el valor conocido

---

## 📝 Notas Importantes

1. **Seguridad:**
   - ❌ **NUNCA** subas valores de variables de entorno a Git
   - ❌ **NUNCA** compartas valores públicamente
   - ✅ Los valores están en `.gitignore`
   - ✅ Usa diferentes valores para desarrollo y producción

2. **Sincronización:**
   - ✅ Los valores de `CRON_TOKEN`, `INGEST_KEY` y `FRED_API_KEY` deben ser **idénticos** en Vercel y GitHub
   - ✅ `APP_URL` en GitHub debe apuntar a la URL de Vercel
   - ⚠️ Si cambias un valor en Vercel, **cámbialo también en GitHub**

3. **Variables Automáticas:**
   - ✅ `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` son automáticas (no configurar)
   - ✅ Se usan para detectar el entorno y configurar la base de datos

---

## 🚨 Problemas Comunes

### Problema: Workflows fallan con 401 Unauthorized

**Causa:** Los valores de `CRON_TOKEN` o `INGEST_KEY` no coinciden entre Vercel y GitHub.

**Solución:**
1. Verifica los valores en Vercel
2. Actualiza los secrets en GitHub con los mismos valores
3. Ejecuta el workflow de nuevo

### Problema: /api/health devuelve 500

**Causa:** Probablemente NO es un problema de variables de entorno (el endpoint no las requiere).

**Solución:**
1. Revisa los logs de Vercel (ver `VERIFICACION-ERROR-500-HEALTH.md`)
2. Verifica que la base de datos se pueda inicializar
3. Verifica que `/tmp` sea accesible en Vercel

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

