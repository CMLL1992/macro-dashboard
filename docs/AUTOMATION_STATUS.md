# 📊 Estado de Automatización del Dashboard

**Fecha de revisión:** 2025-11-12

## ✅ Lo que SÍ está automatizado

### 1. **Vercel Cron (Diario)**
- **Endpoint:** `/api/warmup`
- **Horario:** `0 0 * * *` (00:00 UTC / 01:00 Madrid)
- **Qué hace:**
  - ✅ Actualiza datos FRED (14 series macroeconómicas)
  - ✅ Inicializa sistema de notificaciones
  - ✅ Pre-calienta diagnóstico macro y correlaciones (solo cache, no recalcula)
- **Limitación:** ❌ NO actualiza correlaciones ni bias automáticamente

### 2. **GitHub Actions - Daily Jobs**
- **Archivo:** `.github/workflows/daily-jobs.yml`
- **Horario:** 
  - `0 6 * * 1-5` (06:00 UTC / 07:00 Madrid, lunes-viernes)
  - `15 6 * * 1-5` (06:15 UTC / 07:15 Madrid, lunes-viernes)
- **Qué hace:**
  - ✅ Ingest FRED (`/api/jobs/ingest/fred`)
  - ✅ Calcula correlaciones (`/api/jobs/correlations`)
  - ✅ Calcula bias (`/api/jobs/compute/bias`)
- **Requisitos:** 
  - Secrets configurados: `CRON_TOKEN`, `APP_URL`
  - ⚠️ **Verificar que estos secrets estén configurados en GitHub**

### 3. **GitHub Actions - Automation (Parcial)**
- **Archivo:** `.github/workflows/automation.yml`
- **Horario:** 
  - `5 5 * * *` (06:05 Madrid, diario)
  - `10 5 * * *` (06:10 Madrid, diario)
  - `5 */4 * * *` (cada 4 horas)
- **Problema:** ❌ Llama a endpoints que **NO EXISTEN**:
  - `/api/jobs/ingest/macro` (no existe, debería ser `/api/jobs/ingest/fred`)
  - `/api/jobs/compute/signals` (no existe)
  - `/api/jobs/confirm` (no existe)
  - `/api/jobs/alerts/emit` (no existe)
  - `/api/jobs/qa/report` (no existe)

## ❌ Lo que NO está automatizado

### 1. **Noticias (News)**
- **Endpoint:** `/api/news/insert`
- **Autenticación:** Requiere `X-INGEST-KEY` header
- **Estado:** ❌ **NO automatizado**
- **Requisito:** Necesita un pipeline externo que:
  1. Recolecte noticias (BLS, TradingEconomics, etc.)
  2. Haga `POST /api/news/insert` con `X-INGEST-KEY`
  3. El sistema enviará notificaciones Telegram automáticamente

### 2. **Calendario (Calendar Events)**
- **Endpoint:** `/api/calendar/insert`
- **Autenticación:** Requiere `X-INGEST-KEY` header
- **Estado:** ❌ **NO automatizado**
- **Requisito:** Necesita un pipeline externo que:
  1. Recolecte eventos del calendario económico
  2. Haga `POST /api/calendar/insert` con `X-INGEST-KEY`

### 3. **Weekly Preview (Previa Semanal)**
- **Endpoint:** `/api/jobs/weekly`
- **Autenticación:** Requiere `CRON_TOKEN` o `X-INGEST-KEY`
- **Estado:** ⚠️ **Parcialmente automatizado**
- **Scheduler interno:** ✅ Configurado para domingos 18:00 Europe/Madrid
- **Problema:** ❌ El scheduler interno depende de que la app esté "caliente" (warm)
- **Recomendación:** Añadir a GitHub Actions o Vercel Cron

### 4. **Maintenance (Mantenimiento)**
- **Endpoint:** `/api/jobs/maintenance`
- **Autenticación:** Requiere `CRON_TOKEN`
- **Estado:** ⚠️ **Configurado pero no activo**
- **Problema:** El workflow `daily-jobs.yml` tiene un job `maintenance` pero sin schedule válido

## 🔧 Recomendaciones para Completar la Automatización

### Prioridad Alta

1. **Corregir `automation.yml`**
   - Eliminar endpoints que no existen
   - Usar solo endpoints reales: `/api/jobs/ingest/fred`, `/api/jobs/correlations`, `/api/jobs/compute/bias`

2. **Añadir Weekly a Vercel Cron o GitHub Actions**
   ```json
   // En vercel.json
   {
     "crons": [
       { "path": "/api/warmup", "schedule": "0 0 * * *" },
       { "path": "/api/jobs/weekly", "schedule": "0 17 * * 0" }  // Domingo 18:00 Madrid
     ]
   }
   ```

3. **Añadir Maintenance a GitHub Actions**
   - Configurar schedule semanal en `daily-jobs.yml`

### Prioridad Media

4. **Crear pipeline externo para Noticias**
   - Opciones: Python script, GitHub Action, servicio externo
   - Debe hacer `POST /api/news/insert` con `X-INGEST-KEY`

5. **Crear pipeline externo para Calendario**
   - Similar a noticias
   - Debe hacer `POST /api/calendar/insert` con `X-INGEST-KEY`

### Verificaciones Necesarias

- [ ] Verificar que `CRON_TOKEN` y `APP_URL` están configurados en GitHub Secrets
- [ ] Verificar que `INGEST_KEY` está configurado en Vercel Environment Variables
- [ ] Probar que los workflows de GitHub Actions se ejecutan correctamente
- [ ] Verificar que el cron de Vercel se ejecuta diariamente

## 📋 Resumen Ejecutivo

| Componente | Estado | Automatización |
|------------|--------|----------------|
| **Datos FRED** | ✅ | Vercel Cron (diario) + GitHub Actions (lunes-viernes) |
| **Correlaciones** | ⚠️ | Solo GitHub Actions (lunes-viernes) |
| **Bias** | ⚠️ | Solo GitHub Actions (lunes-viernes) |
| **Noticias** | ❌ | Requiere pipeline externo |
| **Calendario** | ❌ | Requiere pipeline externo |
| **Weekly Preview** | ⚠️ | Scheduler interno (depende de warm app) |
| **Maintenance** | ⚠️ | Configurado pero no activo |

## 🎯 Conclusión

**El proyecto tiene automatización PARCIAL:**

✅ **Funciona:**
- Actualización diaria de datos FRED (Vercel Cron)
- Actualización de FRED, correlaciones y bias (GitHub Actions, lunes-viernes)

❌ **Falta:**
- Automatización completa de correlaciones y bias (solo lunes-viernes)
- Pipeline para noticias
- Pipeline para calendario
- Weekly preview confiable (mejor en cron externo)
- Maintenance activo

**Recomendación:** Completar la automatización siguiendo las prioridades indicadas arriba.

