# Guía de Diagnóstico: Ingesta de Indicadores Europeos

## ✅ Estado Actual

- **Frontend**: ✅ Funciona correctamente - todos los 13 indicadores EU se muestran
- **CPI y Core CPI**: ✅ Tienen datos y se muestran correctamente
- **Resto de indicadores**: ❌ No tienen datos (muestran "—")

## 🔍 Paso 1: Verificar Datos en Base de Datos

### Si usas SQLite local:

```bash
# Ejecutar script de verificación
./scripts/check-eu-data.sh

# O manualmente:
sqlite3 macro.db "
SELECT series_id,
       COUNT(*)    AS n,
       MIN(date)   AS first_date,
       MAX(date)   AS last_date
FROM macro_observations
WHERE series_id LIKE 'EU_%'
GROUP BY series_id
ORDER BY series_id;
"
```

### Si usas Turso:

```bash
turso db shell <database-name> "
SELECT series_id,
       COUNT(*)    AS n,
       MIN(date)   AS first_date,
       MAX(date)   AS last_date
FROM macro_observations
WHERE series_id LIKE 'EU_%'
GROUP BY series_id
ORDER BY series_id;
"
```

**Qué buscar:**
- `EU_CPI_YOY`, `EU_CPI_CORE_YOY`: Deberían tener `n > 0` (ya confirmado)
- `EU_GDP_YOY`, `EU_GDP_QOQ`: Si `n = 0` → no se ha ingerido nada
- `EU_UNEMPLOYMENT`: Si `n = 0` → no se ha ingerido nada
- `EU_PMI_*`: Si `n = 0` → no se ha ingerido nada
- `EU_RETAIL_SALES_YOY`, `EU_INDUSTRIAL_PRODUCTION_YOY`, `EU_CONSUMER_CONFIDENCE`: Si `n = 0` → no se ha ingerido nada
- `EU_ZEW_SENTIMENT`, `EU_ECB_RATE`: Si `n = 0` → no se ha ingerido nada

---

## 🔍 Paso 2: Ejecutar Job de Ingesta y Ver Logs

```bash
curl -X POST \
  -H "Authorization: Bearer dev_local_token" \
  http://localhost:3000/api/jobs/ingest/european | jq
```

**En la consola del servidor, buscar:**
- `{"level":"info","message":"Fetching EU_GDP_YOY from ECB", ...}`
- `{"level":"info","message":"Fetched EU_GDP_YOY","points":XXX}`
- `{"level":"error","message":"Failed to fetch EU_UNEMPLOYMENT","error":"404 ..."}`

**Qué buscar:**
- Series con `points: 0` → la API no devolvió datos
- `level:"error"` → fallo en la ingesta
- Errores 404 → código de serie incorrecto
- Errores 401/403 → falta API key (Trading Economics)
- Timeouts → problema con endpoint de ECB

---

## 🔧 Paso 3: Corregir Ingesta por Fuente

### 🔵 ECB (GDP, Unemployment, ECB Rate, CPI)

**Códigos actuales en `config/european-indicators.json`:**

✅ **CPI (funcionan):**
- `EU_CPI_YOY`: Flow `ICP`, Key `M.U2.Y.000000.3.INX`
- `EU_CPI_CORE_YOY`: Flow `ICP`, Key `M.U2.Y.XEF000.3.INX`

⚠️ **GDP (necesitan verificación):**
- `EU_GDP_QOQ`: Flow `MNA`, Key `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N`
- `EU_GDP_YOY`: Flow `MNA`, Key `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N`

✅ **Unemployment (corregido):**
- `EU_UNEMPLOYMENT`: Flow `LFSI`, Key `M.I8.S.UNEHRT.TOTAL0.15_74.T`

✅ **ECB Rate (corregido):**
- `EU_ECB_RATE`: Flow `FM`, Key `M.U2.EUR.4F.KR.MRR_FR.LEV`

**Para verificar códigos ECB:**
1. Ir a: https://data.ecb.europa.eu/
2. Buscar la serie específica
3. Copiar el código exacto del key
4. Actualizar en `config/european-indicators.json`

**Probar endpoint manualmente:**
```bash
# Ejemplo para ECB Rate
curl "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.4F.KR.MRR_FR.LEV?format=jsondata&compressed=false" | jq
```

---

### 🟡 DBnomics (Retail Sales, Industrial Production, Consumer Confidence)

**Códigos actuales en `config/european-indicators.json`:**

- `EU_RETAIL_SALES_YOY`: Provider `Eurostat`, Dataset `sts_trtu_m`, Series `M.CAL_ADJ.SA.TRTU.TOT.NS.0000.EA19`
- `EU_INDUSTRIAL_PRODUCTION_YOY`: Provider `Eurostat`, Dataset `sts_inpr_m`, Series `M.CAL_ADJ.SA.INPR.TOT.NS.0000.EA19`
- `EU_CONSUMER_CONFIDENCE`: Provider `Eurostat`, Dataset `ei_bsco_m`, Series `M.BAL.M.NSA.EC.ECI.EA19`

**Para verificar códigos DBnomics:**
1. Ir a: https://db.nomics.world/
2. Buscar: "Eurostat" → buscar dataset específico
3. Encontrar la serie exacta para Eurozone (EA19 o EA20)
4. Copiar el código exacto (formato: `provider/dataset/series`)
5. Actualizar en `config/european-indicators.json`

**Ejemplos de códigos correctos (verificar en DBnomics):**
- Retail Sales: `Eurostat/sts_trtu_m/M.SCA.SCA.TRTU.TOTAL.0.EA20`
- Industrial Production: `Eurostat/sts_inpr_m/M.CAL_ADJ.SA.PROD.IIP.TOTAL.0.EA20`
- Consumer Confidence: `Eurostat/ei_bsco_m/M.BS-CSMCI.SA.BAL.EA19`

**Probar endpoint manualmente:**
```bash
# Ejemplo para Retail Sales
curl "https://api.db.nomics.world/v22/series/Eurostat/sts_trtu_m/M.CAL_ADJ.SA.TRTU.TOT.NS.0000.EA19" | jq
```

---

### 🟠 Trading Economics (PMIs, ZEW)

**Códigos actuales en `config/european-indicators.json`:**

- `EU_PMI_MANUFACTURING`: Series `eurozone-pmi-manufacturing`
- `EU_PMI_SERVICES`: Series `eurozone-pmi-services`
- `EU_PMI_COMPOSITE`: Series `eurozone-pmi-composite`
- `EU_ZEW_SENTIMENT`: Series `eurozone-zew-economic-sentiment`

**Verificar:**
1. Que `TRADING_ECONOMICS_API_KEY` esté configurada en `.env.local`
2. Que los IDs de serie coincidan con lo que espera el ingestor
3. Revisar `packages/ingestors/tradingeconomics.ts` para ver el formato esperado

**Si falta API key:**
```bash
# Agregar a .env.local
TRADING_ECONOMICS_API_KEY=tu_api_key_aqui
```

**Probar endpoint manualmente:**
```bash
# Ejemplo (requiere API key)
curl "https://api.tradingeconomics.com/euro-area/manufacturing-pmi?c=tu_api_key" | jq
```

---

## 📋 Checklist de Verificación

Después de corregir cada fuente:

1. ✅ Ejecutar job: `curl -X POST -H "Authorization: Bearer dev_local_token" http://localhost:3000/api/jobs/ingest/european`
2. ✅ Verificar BD: `./scripts/check-eu-data.sh`
3. ✅ Verificar que `COUNT(*) > 0` para la serie corregida
4. ✅ Verificar que `MAX(date)` sea reciente
5. ✅ Hard refresh del dashboard (Ctrl+Shift+R)
6. ✅ Verificar que el indicador muestra datos en la tabla amarilla de debug
7. ✅ Verificar que el indicador muestra datos en el bloque EUROZONA

---

## 🎯 Objetivo Final

Todos los indicadores EU deberían tener:
- `COUNT(*) > 0` en la base de datos
- `MAX(date)` reciente (últimos meses)
- Valores mostrándose en el dashboard (no "—")

---

## 📝 Notas

- Los códigos de CPI ya funcionan → usar como referencia
- Los códigos de ECB Rate y Unemployment fueron corregidos según tus indicaciones
- Los códigos de DBnomics y Trading Economics pueden necesitar verificación manual en las APIs oficiales
- Si un código devuelve 404, buscar el código correcto en la documentación oficial de la API

