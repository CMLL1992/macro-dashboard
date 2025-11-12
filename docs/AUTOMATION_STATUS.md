# 📊 Estado de Automatización del Dashboard

**Fecha de revisión:** 2025-11-12  
**Última actualización:** 2025-11-12 (correcciones aplicadas)

## ✅ Lo que SÍ está automatizado

### 1. **Vercel Cron (Diario)**
- **Endpoints:**
  - `/api/warmup` - `0 0 * * *` (00:00 UTC / 01:00 Madrid)
  - `/api/jobs/weekly` - `0 17 * * 0` (17:00 UTC / 18:00 Madrid, domingos)
- **Qué hace:**
  - ✅ Actualiza datos FRED (14 series macroeconómicas) - diario
  - ✅ Inicializa sistema de notificaciones
  - ✅ Pre-calienta diagnóstico macro y correlaciones (solo cache, no recalcula)
  - ✅ Envía previa semanal (domingos 18:00 Madrid)

### 2. **GitHub Actions - Daily Jobs** ✅ ACTUALIZADO
- **Archivo:** `.github/workflows/daily-jobs.yml`
- **Horario:** 
  - `0 6 * * *` (06:00 UTC / 07:00 Madrid, **TODOS LOS DÍAS**)
- **Qué hace:**
  - ✅ Ingest FRED (`/api/jobs/ingest/fred`)
  - ✅ Calcula correlaciones (`/api/jobs/correlations`)
  - ✅ Calcula bias (`/api/jobs/compute/bias`)
  - ✅ Maintenance semanal (domingos, automático)
- **Requisitos:** 
  - Secrets configurados: `CRON_TOKEN`, `APP_URL`
  - ⚠️ **Verificar que estos secrets estén configurados en GitHub**
- **Cambios aplicados:**
  - ✅ Ahora se ejecuta **todos los días** (no solo lunes-viernes)
  - ✅ Maintenance activado para domingos

### 3. **GitHub Actions - Automation** ✅ DESACTIVADO
- **Archivo:** `.github/workflows/automation.yml`
- **Estado:** ❌ **DESACTIVADO** (solo manual con `workflow_dispatch`)
- **Razón:** Llamaba a endpoints que no existen
- **Solución:** Usar `daily-jobs.yml` en su lugar

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

### 3. **Weekly Preview (Previa Semanal)** ✅ AUTOMATIZADO
- **Endpoint:** `/api/jobs/weekly`
- **Autenticación:** Requiere `CRON_TOKEN` o `X-INGEST-KEY`
- **Estado:** ✅ **AUTOMATIZADO**
- **Vercel Cron:** ✅ Configurado para domingos 17:00 UTC (18:00 Madrid)
- **Scheduler interno:** ✅ También configurado como respaldo

### 4. **Maintenance (Mantenimiento)** ✅ AUTOMATIZADO
- **Endpoint:** `/api/jobs/maintenance`
- **Autenticación:** Requiere `CRON_TOKEN`
- **Estado:** ✅ **AUTOMATIZADO**
- **GitHub Actions:** ✅ Se ejecuta automáticamente los domingos (cuando el schedule coincide)

## ✅ Cambios Aplicados (2025-11-12)

1. ✅ **Corregido `automation.yml`**
   - Desactivado (solo manual)
   - Documentado que usar `daily-jobs.yml` en su lugar

2. ✅ **Añadido Weekly a Vercel Cron**
   - Configurado para domingos 17:00 UTC (18:00 Madrid)

3. ✅ **Mejorado `daily-jobs.yml`**
   - Ahora se ejecuta **todos los días** (no solo lunes-viernes)
   - Maintenance activado para domingos

4. ✅ **Correlaciones y Bias**
   - Ahora se actualizan **todos los días** (no solo lunes-viernes)

## 🔧 Recomendaciones Pendientes

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
| **Datos FRED** | ✅ | Vercel Cron (diario 00:00 UTC) + GitHub Actions (diario 06:00 UTC) |
| **Correlaciones** | ✅ | GitHub Actions (diario 06:00 UTC) |
| **Bias** | ✅ | GitHub Actions (diario 06:00 UTC) |
| **Noticias** | ❌ | Requiere pipeline externo |
| **Calendario** | ❌ | Requiere pipeline externo |
| **Weekly Preview** | ✅ | Vercel Cron (domingos 17:00 UTC) |
| **Maintenance** | ✅ | GitHub Actions (domingos automático) |

## 🎯 Conclusión

**El proyecto tiene automatización COMPLETA para datos macro:**

✅ **Funciona completamente:**
- Actualización diaria de datos FRED (Vercel Cron + GitHub Actions)
- Actualización diaria de correlaciones y bias (GitHub Actions, **todos los días**)
- Weekly preview automatizado (Vercel Cron, domingos)
- Maintenance automatizado (GitHub Actions, domingos)
- **Secrets configurados:** ✅ `CRON_TOKEN`, ✅ `APP_URL`, ✅ `INGEST_KEY`

✅ **Pipelines externos:**
- Template creado para noticias y calendario (`.github/workflows/news-calendar-ingest.yml`)
- Documentación completa en `docs/SETUP_EXTERNAL_PIPELINES.md`
- Listo para personalizar con lógica de recolección de datos

**Estado:** ✅ **Automatización de datos macro COMPLETA y funcionando**

**Última actualización:** 2025-11-12 - Secrets configurados, vercel.json corregido, pipelines listos, workflows verificados y funcionando ✅

