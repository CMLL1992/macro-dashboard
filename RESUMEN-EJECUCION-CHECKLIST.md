# ✅ Resumen de Ejecución de Checklist - Dashboard 100% Operativo

**Fecha:** 2025-12-17  
**Estado:** Implementación completada, pendiente ejecución manual de jobs

---

## ✅ Tareas Completadas

### 1. ✅ GBP/JPY: Jobs mejorados con verificación de inserts
**Archivos modificados:**
- `app/api/jobs/ingest/uk/route.ts` - Añadida verificación de conteo antes/después
- `app/api/jobs/ingest/jp/route.ts` - Añadida verificación de conteo antes/después

**Mejoras:**
- Logging detallado con `beforeCount`, `afterCount`, `newRows`, `firstDate`, `lastDate`
- Verificación de inserts en BD para confirmar que los datos se guardaron

**Pendiente:** Ejecutar manualmente (ver instrucciones abajo)

### 2. ✅ AUD: Mapeado y job creado
**Archivos creados/modificados:**
- `config/currency-indicators.json` - Añadidos 9 indicadores AUD
- `config/au-indicators.json` - Creado archivo de configuración
- `app/api/jobs/ingest/au/route.ts` - Creado job de ingesta
- `.github/workflows/daily-jobs.yml` - Añadido al cron
- `domain/diagnostic.ts` - Añadidos mapeos en `MAP_KEY_TO_WEIGHT_KEY`

**Indicadores mapeados (9):**
- AU_CPI_YOY, AU_CORE_CPI_YOY (inflation)
- AU_GDP_QOQ, AU_GDP_YOY (growth)
- AU_UNEMPLOYMENT_RATE (labor)
- AU_RBA_RATE (monetary)
- AU_MANUFACTURING_PMI, AU_SERVICES_PMI, AU_RETAIL_SALES_YOY (growth)

**Pendiente:** Ejecutar manualmente (ver instrucciones abajo)

### 4. ✅ Pares tácticos: Filtrado de insufficient_data
**Archivo modificado:**
- `lib/dashboard-data.ts` (líneas ~637-737)

**Implementación:**
- Filtra pares donde base o quote tienen `insufficient_data`
- Usa función `extractCurrenciesFromPair()` para extraer monedas
- Logs en desarrollo para debugging

**Resultado:** Pares como GBPUSD, USDJPY, AUDUSD no aparecerán si una moneda tiene insufficient_data

### 5. ✅ Escenarios: Filtrado de insufficient_data
**Archivo modificado:**
- `lib/dashboard-data.ts` (líneas ~660-764)

**Implementación:**
- Filtra escenarios donde base o quote tienen `insufficient_data`
- Mismo helper `extractCurrenciesFromPair()` reutilizado

**Resultado:** Escenarios no aparecerán si alguna moneda tiene insufficient_data

### 6. ✅ Régimen global: Validación de cobertura y frescura
**Archivos modificados:**
- `lib/dashboard-data.ts` - Añadida función `validateGlobalRegimeCoverage()`
- `app/dashboard/page.tsx` - Añadido aviso visual si régimen no es confiable

**Implementación:**
- Valida cobertura mínima (30%) de indicadores clave
- Valida ratio de datos obsoletos (máximo 40%)
- Muestra aviso en UI si `isReliable = false`

**Indicadores clave validados:**
- USD Bias: twex, t10y2y, t10y3m, pce_yoy, gdp_yoy
- Quad: cpi_yoy, gdp_yoy

### 7. ✅ Tabla indicadores: Columna última actualización
**Archivos modificados:**
- `lib/db/read-macro.ts` - Añadida función `getSeriesLastUpdated()`
- `lib/db/read-macro.ts` - Añadido campo `lastUpdated` a `LatestPointWithPrev`
- `lib/dashboard-data.ts` - Añadido campo `lastUpdated` a `IndicatorRow`
- `app/dashboard/page.tsx` - Añadida columna "Última actualización"

**Implementación:**
- Obtiene `last_updated` desde `macro_series.last_updated`
- Muestra en nueva columna de la tabla
- Fallback a fecha del dato si `last_updated` no está disponible

---

## 🔄 Tareas Pendientes (Requieren Ejecución Manual)

### 1. Ejecutar jobs UK/JP/AU manualmente

**Prerrequisitos:**
```bash
export CRON_TOKEN='tu-token-cron'
export APP_URL='https://tu-app.vercel.app'  # o 'http://localhost:3000' para local
```

**Opción A: Usar script (recomendado)**
```bash
cd "/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data 2"
./scripts/ejecutar-jobs-manual.sh
```

**Opción B: Ejecutar manualmente**
```bash
# UK (GBP)
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/uk"

# JP (JPY)
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/jp"

# AU (AUD)
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/au"
```

**Verificación:**
- Revisar respuesta JSON: `{"success": true, "ingested": X, "errors": Y}`
- Verificar logs en Vercel/terminal para confirmar inserts
- Verificar en dashboard que GBP/JPY/AUD ya no muestran "insufficient_data"

### 2. Recalcular bias después de ingesta
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/compute/bias"
```

### 3. Revisar pipelines USD/EUR para datos obsoletos

**Investigar:**
1. Revisar logs de Vercel para jobs `/api/jobs/ingest/fred` y `/api/jobs/ingest/european`
2. Verificar si hay errores silenciosos o timeouts
3. Verificar si `TRADING_ECONOMICS_API_KEY` está configurado (para EUR)
4. Verificar si `FRED_API_KEY` está configurado (para USD)

**Ejecutar manualmente:**
```bash
# FRED (USD)
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/fred?reset=true"

# European (EUR)
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/european"
```

**Verificar actualización:**
- Revisar que indicadores como CPI, GDP, PCE se actualicen
- Verificar que fechas cambien de 2025-09-01 a fechas más recientes

---

## 📊 Criterios de Aceptación

### ✅ GBP/JPY/AUD
- [ ] GBP pasa de 0/11 a ≥ 3 indicadores presentes y ≥ 30% coverage
- [ ] JPY pasa de 0/12 a ≥ 3 presentes y ≥ 30% coverage
- [ ] AUD pasa de 0/9 a ≥ 3 presentes y ≥ 30% coverage
- [ ] En UI ya no sale "insufficient_data" para GBP/JPY/AUD

### ✅ Pares tácticos y Escenarios
- [ ] No aparece ningún par/escenario "operable" si una moneda no tiene macro suficiente
- [ ] Si se muestra, debe quedar explícito "Datos incompletos" y sin confianza alta

### ✅ Régimen global
- [ ] El régimen global no se presenta como "limpio" si está calculado con input stale/incompleto
- [ ] Se muestra aviso visual cuando `coverage.isReliable = false`

### ✅ Tabla indicadores
- [ ] Columna "Última actualización" visible
- [ ] Muestra fecha desde `macro_series.last_updated` o fallback a fecha del dato

---

## 🔍 Verificación Post-Ejecución

### 1. Verificar cobertura en dashboard
```bash
# Verificar que GBP/JPY/AUD tienen regímenes calculados
curl "$APP_URL/api/dashboard" | jq '.data.currencyRegimes'
```

**Esperado:**
```json
{
  "GBP": {
    "regime": "reflation|stagflation|recession|goldilocks|mixed",
    "probability": 0.XX,
    "description": "..."
  },
  "JPY": { ... },
  "AUD": { ... }
}
```

### 2. Verificar que no hay pares con insufficient_data
```bash
curl "$APP_URL/api/dashboard" | jq '.data.tacticalRows[] | select(.pair | test("GBP|JPY|AUD"))'
```

**Esperado:** No deberían aparecer pares como GBPUSD, USDJPY, AUDUSD si GBP/JPY/AUD tienen insufficient_data

### 3. Verificar logs de jobs
Revisar logs en Vercel o terminal para confirmar:
- `ingested: X` > 0 para UK/JP/AU
- `newRows: Y` > 0 (indica que se insertaron datos nuevos)
- `errors: 0` o errores específicos documentados

---

## 📝 Notas Técnicas

### Trading Economics API
- **Fuente:** Trading Economics para UK/JP/AU
- **Rate limit:** 2 segundos entre requests (implementado en jobs)
- **Variable requerida:** `TRADING_ECONOMICS_API_KEY`

### Validación de Régimen Global
- **Umbrales:**
  - `MIN_COVERAGE = 0.3` (30% mínimo)
  - `MAX_STALE_RATIO = 0.4` (máximo 40% stale)
- **Indicadores clave:** twex, t10y2y, t10y3m, pce_yoy, gdp_yoy, cpi_yoy

### Filtrado de Pares/Escenarios
- **Lógica:** Verifica `currencyRegimes[currency]?.regime === 'insufficient_data'`
- **Impacto:** Previene señales falsas cuando falta macro para una moneda

---

## 🎯 Próximos Pasos

1. **Ejecutar jobs UK/JP/AU** usando el script o manualmente
2. **Recalcular bias** después de la ingesta
3. **Verificar dashboard** para confirmar que GBP/JPY/AUD tienen regímenes
4. **Revisar pipelines USD/EUR** si datos siguen obsoletos
5. **Documentar resultados** con screenshots/logs

---

## ✅ Checklist Final

- [x] Jobs UK/JP mejorados con verificación
- [x] AUD mapeado y job creado
- [x] Pares tácticos filtran insufficient_data
- [x] Escenarios filtran insufficient_data
- [x] Régimen global valida cobertura/frescura
- [x] Tabla indicadores tiene columna última actualización
- [ ] **Ejecutar jobs UK/JP/AU manualmente** ⚠️ PENDIENTE
- [ ] **Verificar que GBP/JPY/AUD tienen regímenes** ⚠️ PENDIENTE
- [ ] **Revisar pipelines USD/EUR** ⚠️ PENDIENTE
