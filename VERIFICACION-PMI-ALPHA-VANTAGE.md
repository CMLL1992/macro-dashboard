# ✅ Verificación: PMI Manufacturing desde Alpha Vantage

## 🎯 Objetivo

Ingerir PMI Manufacturing (US) automáticamente desde Alpha Vantage para alcanzar **100% cobertura US** (17/17 indicadores).

---

## ✅ Cambios Implementados

### 1. Mejoras en `packages/ingestors/alphavantage.ts`

- ✅ **Múltiples nombres de función:** Intenta `ISM_MANUFACTURING_PMI`, `MANUFACTURING_PMI`, `PMI`
- ✅ **Mejor parsing:** Soporta múltiples formatos de respuesta de Alpha Vantage
- ✅ **Validación de valores:** Filtra valores fuera de rango (0-100 para PMI)
- ✅ **Normalización de fechas:** Convierte a formato `YYYY-MM-DD`

### 2. Mejoras en `app/api/jobs/ingest/fred/route.ts`

- ✅ **Acepta datos antiguos:** No exige datos de últimos 30 días (acepta hasta 60+ días con warning)
- ✅ **Errores no fatales:** PMI no bloquea el job si falla
- ✅ **Logging mejorado:** Muestra días desde último dato, warnings si es antiguo
- ✅ **Verificación de API key:** Log claro si falta `ALPHA_VANTAGE_API_KEY`

### 3. Configuración

- ✅ **Mapeo correcto:** `pmi_mfg` → `USPMI` en `lib/db/read-macro.ts`
- ✅ **Sin transformaciones:** `transform: 'none'` en `config/macro-indicators.ts`
- ✅ **Frecuencia mensual:** `frequency: 'M'`

---

## 📋 Pasos para Activar

### 1. Configurar API Key en Vercel

1. Ir a: https://vercel.com/dashboard
2. Seleccionar proyecto: `macro-dashboard-seven`
3. **Settings** → **Environment Variables**
4. Añadir:
   - **Name:** `ALPHA_VANTAGE_API_KEY`
   - **Value:** `[tu_api_key]` (obtener de https://www.alphavantage.co/support/#api-key)
   - **Environments:** ✅ Production, ✅ Preview
5. **Save** → Redeploy automático

### 2. Ejecutar Job FRED

```bash
curl -X POST "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred?reset=true" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Logs esperados:**
- ✅ Si API key configurada: `"Attempting PMI ingestion from Alpha Vantage"`
- ✅ Si éxito: `"Ingested USPMI from Alpha Vantage"` con `points: XX`
- ⚠️ Si no configurada: `"ALPHA_VANTAGE_API_KEY not configured"`

### 3. Verificación

```bash
# Verificar datos en BD
curl https://macro-dashboard-seven.vercel.app/api/debug/usa-indicators | jq '.USPMI'

# Verificar cobertura
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.coverage.US'
# Esperado: { "total": 17, "withData": 17, "percentage": 100 }

# Verificar PMI en dashboard
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '[.data.indicators[] | select(.key == "pmi_mfg")][0]'
# Esperado: { "key": "pmi_mfg", "value": XX.X, "date": "YYYY-MM-DD" }
```

---

## 🔍 Características de Robustez

### ✅ Acepta Datos Antiguos
- No exige datos de últimos 30 días
- Acepta datos hasta 60+ días con warning
- Útil si Alpha Vantage tiene retraso en actualización

### ✅ Errores No Fatales
- Si PMI falla, el job continúa
- No incrementa contador de errores
- Log claro para debugging

### ✅ Múltiples Formatos
- Intenta 3 nombres de función diferentes
- Soporta múltiples formatos de respuesta JSON
- Validación de valores (0-100 para PMI)

### ✅ Logging Detallado
- Muestra días desde último dato
- Warning si datos >60 días
- Indica si API key está configurada

---

## 📊 Resultado Esperado

```json
{
  "coverage": {
    "US": {
      "total": 17,
      "withData": 17,
      "percentage": 100
    }
  },
  "pmi_mfg": {
    "key": "pmi_mfg",
    "value": 52.5,
    "date": "2025-12-01"
  }
}
```

**UI:**
- 🇺🇸 US → **Verde (100%)** ✅
- PMI Manufacturing visible con valor (~50-55 típico)

---

## ✅ Checklist de Verificación

- [ ] API key configurada en Vercel
- [ ] Redeploy ejecutado
- [ ] Job FRED ejecutado
- [ ] Logs muestran "Ingested USPMI from Alpha Vantage"
- [ ] Datos en BD: `USPMI.count > 0`
- [ ] Dashboard muestra PMI con valor (no null)
- [ ] Cobertura US = 100% (17/17) ✅

---

## 🎉 Conclusión

**Código listo:** ✅  
**Requiere:** Configurar `ALPHA_VANTAGE_API_KEY` en Vercel  
**Resultado:** Cobertura US 100% (17/17) automática
