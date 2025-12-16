# 🔧 Configurar Alpha Vantage para PMI Manufacturing

## Objetivo

Configurar `ALPHA_VANTAGE_API_KEY` en Vercel para que el job FRED ingiera automáticamente USPMI (PMI Manufacturing) desde Alpha Vantage.

---

## 📋 Pasos

### 1. Obtener API Key de Alpha Vantage

1. Ir a: https://www.alphavantage.co/support/#api-key
2. Completar el formulario (nombre, email)
3. Copiar la API key que recibes por email

**Nota:** La API gratuita tiene límites de rate (5 calls/min, 500 calls/day), pero es suficiente para ingesta mensual de PMI.

---

### 2. Configurar en Vercel

1. Ir a: https://vercel.com/dashboard
2. Seleccionar el proyecto: `macro-dashboard-seven` (o el nombre de tu proyecto)
3. Ir a: **Settings** → **Environment Variables**
4. Añadir nueva variable:
   - **Name:** `ALPHA_VANTAGE_API_KEY`
   - **Value:** `tu_api_key_aqui` (la key que recibiste)
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Guardar
6. **Redeploy** automático (o manual si no se activa automáticamente)

---

### 3. Verificar Configuración

Después del redeploy, verificar que la variable está disponible:

```bash
# Verificar en logs de Vercel (después de ejecutar job)
# Debería mostrar: "Attempting PMI ingestion from Alpha Vantage"
```

O usar el endpoint de debug:

```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/usa-indicators | jq '.USPMI'
```

---

### 4. Ejecutar Job FRED

El job FRED intentará ingerir PMI automáticamente cuando:
- Es el último batch del job
- `ALPHA_VANTAGE_API_KEY` está configurado
- No se ha excedido el tiempo límite (4 minutos)

```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Logs esperados:**
```
[ingest_fred] Attempting PMI ingestion from Alpha Vantage
[ingest_fred] Ingested USPMI from Alpha Vantage
  series_id: 'USPMI'
  points: XX
  lastDate: 'YYYY-MM-DD'
  lastValue: XX.X
```

---

### 5. Verificación Final

```bash
# Verificar cobertura
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.coverage.US'
# Debería mostrar: { "total": 17, "withData": 17, "percentage": 100 }

# Verificar PMI en dashboard
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '[.data.indicators[] | select(.key == "pmi_mfg")][0]'
# Debería mostrar: { "key": "pmi_mfg", "value": XX.X, "date": "YYYY-MM-DD" }
```

---

## 🔍 Troubleshooting

### Error: "ALPHA_VANTAGE_API_KEY not configured"
- **Causa:** Variable de entorno no configurada o no aplicada
- **Solución:** 
  1. Verificar que la variable está en Vercel
  2. Hacer redeploy manual
  3. Verificar en logs que la variable está disponible

### Error: "Alpha Vantage API rate limit exceeded"
- **Causa:** Límite de rate de la API gratuita (5 calls/min)
- **Solución:** Esperar 1 minuto y re-ejecutar, o usar plan premium

### Error: "No observations returned from Alpha Vantage"
- **Causa:** Alpha Vantage puede usar diferentes nombres de función
- **Solución:** El código ya intenta múltiples nombres (`MANUFACTURING_PMI`, `PMI`, `ISM_MANUFACTURING_PMI`)

### PMI no aparece en dashboard después de ingesta
- **Causa:** Mapeo incorrecto o transformación aplicada
- **Solución:** 
  1. Verificar que `pmi_mfg` mapea a `USPMI` en `lib/db/read-macro.ts`
  2. Verificar que `transform: 'none'` en `config/macro-indicators.ts`
  3. Verificar datos en BD: `SELECT * FROM macro_observations WHERE series_id = 'USPMI' ORDER BY date DESC LIMIT 5`

---

## 📝 Notas Técnicas

### Formato de Datos
- **Serie ID:** `USPMI`
- **Fuente:** `ALPHA_VANTAGE`
- **Frecuencia:** `M` (mensual)
- **Transformación:** `none` (índice de difusión, no requiere transformación)
- **Valores típicos:** 40-60 (50 = neutral, >50 = expansión, <50 = contracción)

### Mapeo
- **Dashboard key:** `pmi_mfg`
- **Series ID en BD:** `USPMI`
- **Config:** `config/macro-indicators.ts` → `pmi_mfg: { fredSeriesId: 'USPMI', transform: 'none' }`

---

## ✅ Checklist

- [ ] API key obtenida de Alpha Vantage
- [ ] Variable `ALPHA_VANTAGE_API_KEY` configurada en Vercel (Production + Preview)
- [ ] Redeploy ejecutado
- [ ] Job FRED ejecutado y muestra "Ingested USPMI from Alpha Vantage" en logs
- [ ] Datos verificados en BD: `SELECT COUNT(*) FROM macro_observations WHERE series_id = 'USPMI'`
- [ ] Dashboard muestra PMI con valor (no null)
- [ ] Cobertura US = 100% (17/17)

---

## 🎯 Resultado Esperado

Después de configurar la API key y ejecutar el job:

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

**UI:** Cobertura US pasa a verde (100%) ✅
