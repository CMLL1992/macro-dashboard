# 📋 Inventario del Proyecto Vercel Actual

**Fecha:** 2025-12-11  
**Propósito:** Documentar configuración actual antes de migración

---

## 🔐 Variables de Entorno

### ⚠️ IMPORTANTE: Copiar estos valores del proyecto actual de Vercel

**Acceso:** Vercel Dashboard → Tu Proyecto → Settings → Environment Variables

### Variables OBLIGATORIAS

| Variable | Valor Actual | Entornos | Notas |
|----------|--------------|----------|-------|
| `TURSO_DATABASE_URL` | `[COPIAR DE VERCEL]` | Production, Preview, Development | URL de la BD Turso |
| `TURSO_AUTH_TOKEN` | `[COPIAR DE VERCEL]` | Production, Preview, Development | Token de autenticación Turso |
| `FRED_API_KEY` | `[COPIAR DE VERCEL]` | Production, Preview, Development | API key de FRED |
| `CRON_TOKEN` | `[COPIAR DE VERCEL]` | Production, Preview, Development | Token para jobs |
| `INGEST_KEY` | `[COPIAR DE VERCEL]` | Production, Preview, Development | Key para ingesta |
| `APP_URL` | `[COPIAR DE VERCEL]` | Production (obligatorio) | URL base de la app |

### Variables OPCIONALES (marcar si existen)

- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `TELEGRAM_CHAT_ID`
- [ ] `TELEGRAM_TEST_CHAT_ID`
- [ ] `FMP_API_KEY`
- [ ] `FINNHUB_API_KEY`
- [ ] `NEWSAPI_KEY`
- [ ] `TRADING_ECONOMICS_API_KEY`
- [ ] `DATABASE_PATH`
- [ ] Otras: `_________________`

---

## 🕒 Cron Jobs Actuales

**Fuente:** `vercel.json` en el repositorio

| # | Path | Schedule | Método | Descripción |
|---|------|----------|--------|-------------|
| 1 | `/api/jobs/ingest/fred` | `0 6 * * *` | POST | 6:00 AM diario - Ingesta FRED |
| 2 | `/api/jobs/ingest/european` | `0 7 * * *` | POST | 7:00 AM diario - Ingesta europeos |
| 3 | `/api/jobs/ingest/calendar` | `0 8 * * *` | POST | 8:00 AM diario - Ingesta calendario |
| 4 | `/api/jobs/daily/calendar` | `0 8 * * *` | POST | 8:00 AM diario - Actualización calendario |
| 5 | `/api/jobs/correlations` | `0 9 * * *` | POST | 9:00 AM diario - Cálculo correlaciones |
| 6 | `/api/jobs/compute/bias` | `0 10 * * *` | POST | 10:00 AM diario - Cálculo sesgos |
| 7 | `/api/jobs/weekly` | `0 18 * * 0` | POST | 6:00 PM domingos - Job semanal |

### Cron Jobs Recomendados Adicionales

| # | Path | Schedule | Método | Descripción |
|---|------|----------|--------|-------------|
| 8 | `/api/jobs/transform/indicators` | `0 6:30 * * *` | POST | 6:30 AM diario - Transformación indicadores |
| 9 | `/api/jobs/ingest/assets` | `0 11 * * *` | POST | 11:00 AM diario - Ingesta activos |

---

## 🌍 Dominios y Webhooks

### Dominios Conectados

- [ ] Dominio personalizado: `_________________`
- [ ] Otros dominios: `_________________`

**Verificar en:** Vercel Dashboard → Tu Proyecto → Settings → Domains

### Webhooks Externos

- [ ] Sistema externo 1: `_________________` → Ruta: `_________________`
- [ ] Sistema externo 2: `_________________` → Ruta: `_________________`
- [ ] Otros: `_________________`

---

## 📊 Información del Proyecto

### Proyecto Actual

- **Nombre:** `_________________`
- **URL:** `https://_________________.vercel.app`
- **Repositorio:** `_________________`
- **Branch:** `main` (asumido)

### Node.js Version

- **Requerida:** `20.x` (según `package.json`)
- **Verificar en Vercel:** Settings → General → Node.js Version

---

## ✅ Checklist de Verificación

### Antes de Empezar la Migración

- [ ] Todas las variables de entorno están documentadas
- [ ] Todos los cron jobs están documentados
- [ ] Dominios están documentados (si existen)
- [ ] Webhooks están documentados (si existen)
- [ ] Código está actualizado en GitHub
- [ ] Backup de variables de entorno hecho (valores copiados)

---

## 📝 Instrucciones para Completar

1. **Acceder al proyecto actual de Vercel:**
   - https://vercel.com
   - Seleccionar el proyecto
   - Settings → Environment Variables

2. **Para cada variable:**
   - Click en el ojo 👁️ para ver el valor
   - Copiar el valor en esta tabla
   - **NO compartir estos valores públicamente**

3. **Verificar cron jobs:**
   - Settings → Cron Jobs
   - Comparar con la lista de arriba
   - Añadir cualquier job adicional que exista

4. **Verificar dominios:**
   - Settings → Domains
   - Anotar todos los dominios conectados

5. **Guardar este documento** con los valores completados (localmente, no en Git)

---

**⚠️ IMPORTANTE:** Este documento contiene información sensible.  
**NO** subirlo a Git. Guardarlo localmente y eliminarlo después de la migración.


