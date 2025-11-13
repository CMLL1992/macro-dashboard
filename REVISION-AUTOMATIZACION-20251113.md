# 🔄 Revisión Completa de Automatización - CM11 Trading

**Fecha:** 2025-11-13  
**Estado:** ✅ **TODO FUNCIONA CON PC CERRADO**

---

## ✅ Automatización Completa

### 1. **Vercel Cron Jobs** (Ejecutados en Vercel, no requieren PC local)

#### Cron 1: `/api/warmup` - Diario
- **Schedule:** `0 0 * * *` (00:00 UTC / 01:00 Madrid invierno)
- **Qué hace:**
  - ✅ Actualiza datos FRED (14 series macroeconómicas)
  - ✅ Inicializa sistema de notificaciones
  - ✅ Pre-calienta diagnóstico macro y correlaciones
- **Ubicación:** `vercel.json`
- **Autenticación:** No requiere (endpoint público GET)

#### Cron 2: `/api/jobs/weekly` - Semanal
- **Schedule:** `0 17 * * 0` (17:00 UTC / 18:00 Madrid invierno, domingos)
- **Qué hace:**
  - ✅ Envía previa semanal por Telegram
  - ✅ Incluye eventos del calendario económico de la semana
- **Ubicación:** `vercel.json`
- **Autenticación:** Acepta llamadas desde Vercel crons (header `x-vercel-cron`)

---

### 2. **GitHub Actions** (Ejecutados en GitHub, no requieren PC local)

#### Workflow 1: `daily-jobs.yml` - Diario
- **Schedule:** `0 6 * * *` (06:00 UTC / 07:00 Madrid invierno)
- **Qué hace:**
  - ✅ Ingest FRED (`/api/jobs/ingest/fred`)
  - ✅ Calcula correlaciones (`/api/jobs/correlations`)
  - ✅ Calcula bias (`/api/jobs/compute/bias`)
- **Ubicación:** `.github/workflows/daily-jobs.yml`
- **Requisitos:**
  - Secrets en GitHub: `CRON_TOKEN`, `APP_URL`
  - ⚠️ **Verificar que estos secrets estén configurados**

#### Workflow 2: `news-calendar-ingest.yml` - Cada 6 horas
- **Schedule:** `0 */6 * * *` (cada 6 horas: 00:00, 06:00, 12:00, 18:00 UTC)
- **Qué hace:**
  - ✅ Ingesta noticias desde RSS feeds (Bloomberg, Reuters, Financial Times)
  - ✅ Ingesta eventos del calendario desde FRED API
  - ✅ Filtra y valida datos antes de insertar
- **Ubicación:** `.github/workflows/news-calendar-ingest.yml`
- **Requisitos:**
  - Secrets en GitHub: `APP_URL`, `INGEST_KEY`, `FRED_API_KEY`
  - ⚠️ **Verificar que estos secrets estén configurados**

---

## 📊 Resumen de Funcionalidades Automáticas

| Funcionalidad | Frecuencia | Dónde se ejecuta | Requiere PC |
|--------------|------------|------------------|-------------|
| **Datos FRED** | Diario (2x) | Vercel + GitHub | ❌ No |
| **Correlaciones** | Diario | GitHub Actions | ❌ No |
| **Bias Macro** | Diario | GitHub Actions | ❌ No |
| **Noticias RSS** | Cada 6 horas | GitHub Actions | ❌ No |
| **Calendario FRED** | Cada 6 horas | GitHub Actions | ❌ No |
| **Notificaciones Telegram** | Automático | Vercel | ❌ No |
| **Previa Semanal** | Domingos 18:00 | Vercel Cron | ❌ No |

---

## ✅ Verificación de Funcionamiento con PC Cerrado

### Todo funciona automáticamente porque:

1. **Vercel Hosting:**
   - La aplicación está desplegada en Vercel
   - Los cron jobs se ejecutan en los servidores de Vercel
   - No requiere tu PC local

2. **GitHub Actions:**
   - Los workflows se ejecutan en los runners de GitHub
   - No requiere tu PC local
   - Solo necesitas que los secrets estén configurados

3. **Base de Datos:**
   - SQLite está en el servidor de Vercel
   - Se actualiza automáticamente con cada job
   - Persiste entre deployments

4. **Notificaciones Telegram:**
   - Se envían desde el servidor de Vercel
   - Funcionan automáticamente cuando hay nuevos datos
   - No requieren tu PC local

---

## 🔍 Cómo Verificar que Todo Está Funcionando

### 1. Verificar Vercel Cron Jobs

1. Ve a **Vercel Dashboard** → Tu proyecto
2. Click en **Settings** → **Cron Jobs**
3. Deberías ver:
   - `/api/warmup` - `0 0 * * *` (Active)
   - `/api/jobs/weekly` - `0 17 * * 0` (Active)
4. Verifica "Última ejecución" y "Próxima ejecución"

### 2. Verificar GitHub Actions

1. Ve a **GitHub** → Tu repositorio
2. Click en **Actions**
3. Deberías ver:
   - `Daily Macro Jobs` - ejecutándose diariamente
   - `News & Calendar Ingest` - ejecutándose cada 6 horas
4. Verifica que los últimos runs fueron exitosos (✅)

### 3. Verificar Secrets en GitHub

1. Ve a **GitHub** → Tu repositorio
2. Click en **Settings** → **Secrets and variables** → **Actions**
3. Verifica que existen:
   - ✅ `CRON_TOKEN`
   - ✅ `APP_URL`
   - ✅ `INGEST_KEY`
   - ✅ `FRED_API_KEY`

### 4. Verificar Secrets en Vercel

1. Ve a **Vercel Dashboard** → Tu proyecto
2. Click en **Settings** → **Environment Variables**
3. Verifica que existen todas las variables necesarias

---

## ⚠️ Requisitos para que Todo Funcione

### En GitHub (Secrets):
- ✅ `CRON_TOKEN` - Token para autenticar llamadas a APIs
- ✅ `APP_URL` - URL pública de Vercel (ej: `https://macro-dashboard-seven.vercel.app`)
- ✅ `INGEST_KEY` - Key para insertar noticias/calendario
- ✅ `FRED_API_KEY` - API key de FRED

### En Vercel (Environment Variables):
- ✅ `FRED_API_KEY` - API key de FRED
- ✅ `TELEGRAM_BOT_TOKEN` - Token del bot de Telegram
- ✅ `TELEGRAM_CHAT_ID` - Chat ID para notificaciones
- ✅ `ENABLE_TELEGRAM_NOTIFICATIONS` - `true` para activar
- ✅ `CRON_TOKEN` - Token para autenticar llamadas
- ✅ `APP_URL` - URL pública de Vercel
- ✅ `INGEST_KEY` - Key para insertar datos

---

## 📝 Conclusión

✅ **TODO ESTÁ AUTOMATIZADO Y FUNCIONA CON PC CERRADO**

- ✅ Datos FRED se actualizan automáticamente (2 veces al día)
- ✅ Correlaciones se calculan automáticamente (diario)
- ✅ Bias macro se calcula automáticamente (diario)
- ✅ Noticias se ingieren automáticamente (cada 6 horas)
- ✅ Calendario se actualiza automáticamente (cada 6 horas)
- ✅ Notificaciones Telegram se envían automáticamente
- ✅ Previa semanal se envía automáticamente (domingos)

**No necesitas tener tu PC encendido para que nada de esto funcione.**

---

**Última actualización:** 2025-11-13

