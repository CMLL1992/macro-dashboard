# 📋 Instrucciones: Configurar Alpha Vantage para PMI

## 🎯 Objetivo

Alcanzar **100% cobertura US** (17/17 indicadores) configurando la API key de Alpha Vantage para ingesta automática de PMI Manufacturing.

---

## ✅ Estado Actual

- **Retail YoY:** ✅ Funcionando (8.58%)
- **PMI Manufacturing:** ⚠️ Pendiente (requiere `ALPHA_VANTAGE_API_KEY`)
- **Cobertura US:** 94% (16/17) → Objetivo: 100% (17/17)

---

## 📝 Pasos para Configurar

### 1. Obtener API Key de Alpha Vantage

1. Ir a: https://www.alphavantage.co/support/#api-key
2. Completar formulario (nombre, email)
3. Copiar la API key recibida por email

**Nota:** API gratuita tiene límites (5 calls/min, 500 calls/day) pero es suficiente para PMI mensual.

---

### 2. Configurar en Vercel

1. **Ir a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Seleccionar proyecto: `macro-dashboard-seven`

2. **Añadir Variable de Entorno:**
   - **Settings** → **Environment Variables**
   - **Add New:**
     - **Name:** `ALPHA_VANTAGE_API_KEY`
     - **Value:** `[tu_api_key_aqui]`
     - **Environments:** ✅ Production, ✅ Preview, ✅ Development
   - **Save**

3. **Redeploy:**
   - Vercel redeploy automático (o manual: **Deployments** → **Redeploy**)

---

### 3. Verificar Configuración

Después del redeploy, ejecutar job FRED:

```bash
curl -X POST "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred?reset=true" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Logs esperados en Vercel:**
- ✅ Si API key configurada: `"Attempting PMI ingestion from Alpha Vantage"`
- ✅ Si éxito: `"Ingested USPMI from Alpha Vantage"` con `points: XX`
- ⚠️ Si no configurada: `"ALPHA_VANTAGE_API_KEY not configured"`

---

### 4. Verificación Final

```bash
# Verificar datos en BD
curl https://macro-dashboard-seven.vercel.app/api/debug/usa-indicators | jq '.USPMI'

# Verificar cobertura
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.coverage.US'
# Debería mostrar: { "total": 17, "withData": 17, "percentage": 100 }

# Verificar PMI en dashboard
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '[.data.indicators[] | select(.key == "pmi_mfg")][0]'
# Debería mostrar: { "key": "pmi_mfg", "value": XX.X, "date": "YYYY-MM-DD" }
```

---

## 🔍 Troubleshooting

### "ALPHA_VANTAGE_API_KEY not configured"
- **Causa:** Variable no configurada o no aplicada en redeploy
- **Solución:** 
  1. Verificar en Vercel Settings → Environment Variables
  2. Hacer redeploy manual
  3. Verificar en logs que aparece el mensaje

### "Alpha Vantage API rate limit exceeded"
- **Causa:** Límite de rate (5 calls/min en plan gratuito)
- **Solución:** Esperar 1 minuto y re-ejecutar

### "No observations returned from Alpha Vantage"
- **Causa:** Alpha Vantage puede usar diferentes nombres de función
- **Solución:** El código ya intenta múltiples nombres automáticamente

### PMI no aparece después de ingesta
- **Verificar mapeo:** `pmi_mfg` → `USPMI` en `lib/db/read-macro.ts`
- **Verificar config:** `transform: 'none'` en `config/macro-indicators.ts`
- **Verificar BD:** `SELECT * FROM macro_observations WHERE series_id = 'USPMI' ORDER BY date DESC LIMIT 5`

---

## ✅ Checklist Final

- [ ] API key obtenida de Alpha Vantage
- [ ] Variable configurada en Vercel (Production + Preview)
- [ ] Redeploy ejecutado
- [ ] Job FRED ejecutado y muestra "Ingested USPMI" en logs
- [ ] Datos verificados: `USPMI.count > 0`
- [ ] Dashboard muestra PMI con valor (no null)
- [ ] Cobertura US = 100% (17/17) ✅

---

## 🎯 Resultado Esperado

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

**UI:** Cobertura US pasa a **verde (100%)** ✅

---

## 📚 Documentación Relacionada

- Guía completa: `docs/CONFIGURAR-ALPHA-VANTAGE-PMI.md`
- Resumen técnico: `RESUMEN-FIX-USA-RETAIL-PMI.md`
