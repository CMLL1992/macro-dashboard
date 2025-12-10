# Resumen Completo: Intentos para Mostrar Indicadores Europeos

## 📊 Estado Actual del Problema

**Situación:** Los datos de indicadores europeos (especialmente CPI) están en la base de datos y llegan correctamente hasta `getDashboardData()`, pero **NO aparecen en la interfaz del dashboard**.

**Evidencia:**
- ✅ Base de datos: `EU_CPI_YOY` tiene 347 observaciones, última fecha: 2025-11-01
- ✅ `getAllLatestFromDBWithPrev()`: `eu_cpi_yoy` tiene `value: 2.14`
- ✅ `getMacroDiagnosis()`: `EU_CPI_YOY` tiene `value: 2.14`
- ✅ `getBiasState()`: `EU_CPI_YOY` tiene `value: 2.14`
- ✅ `buildIndicatorRows()`: `eu_cpi_yoy` tiene `value: 2.14`, `category: "Precios / Inflación"`
- ✅ `getDashboardData()`: Los datos están presentes en `indicators` array
- ❌ **Dashboard UI**: Los indicadores NO aparecen en la tabla

---

## 🔍 Todo lo que he Intentado

### 1. **Corrección de Mapeo de Keys**
**Problema identificado:** En `getMacroDiagnosis()`, el `key` cambia de `eu_cpi_yoy` a `EU_CPI_YOY`, pero `buildIndicatorRows()` usaba `row.key` en lugar de `row.originalKey`.

**Solución aplicada:**
- Modificado `buildIndicatorRows()` para usar `row.originalKey ?? row.key` como `finalKey`
- Archivo: `lib/dashboard-data.ts` línea 143

**Resultado:** ❌ No solucionó el problema

---

### 2. **Corrección de Categorías (Case-Insensitive)**
**Problema identificado:** `categoryFor()` buscaba por key exacto, pero los keys pueden estar en diferentes casos.

**Solución aplicada:**
- Modificado `categoryFor()` en `domain/categories.ts` para buscar también en mayúsculas/minúsculas
- Archivo: `domain/categories.ts` línea 72-85

**Resultado:** ❌ No solucionó el problema

---

### 3. **Corrección de Encoding de Categorías**
**Problema identificado:** El JSON mostraba `"Precios / InflaciÃ³n"` (encoding incorrecto) pero el código buscaba `'Precios / Inflación'`.

**Solución aplicada:**
- Agregado normalización de categorías antes de compararlas (eliminando acentos)
- Archivo: `app/dashboard/page.tsx` línea 230-232

**Resultado:** ❌ No solucionó el problema

---

### 4. **Logging Extensivo**
**Agregado logging en múltiples puntos:**
- `lib/db/read-macro.ts`: Logging en `getAllLatestFromDBWithPrev()`
- `domain/diagnostic.ts`: Logging en `getMacroDiagnosis()`
- `domain/macro-engine/bias.ts`: Logging en `getBiasRaw()`
- `lib/dashboard-data.ts`: Logging en `buildIndicatorRows()` y `getDashboardData()`
- `app/dashboard/page.tsx`: Logging en el componente React

**Resultado:** ✅ Confirmó que los datos están llegando correctamente hasta `getDashboardData()`

---

### 5. **Endpoints de Debug**
**Creados endpoints para diagnóstico:**
- `/api/debug/european-indicators`: Muestra el flujo completo de datos
- `/api/debug/dashboard-data`: Muestra exactamente qué devuelve `getDashboardData()`

**Resultado:** ✅ Confirmó que los datos están en `getDashboardData()` pero no aparecen en la UI

---

## 📡 Fuentes de Datos de Indicadores Europeos

### 1. **ECB (European Central Bank) - Statistical Data Warehouse**

**URL Base:**
- Nueva API (Oct 2025): `https://data-api.ecb.europa.eu`
- API Antigua (fallback): `https://sdw-wsrest.ecb.europa.eu`

**Formato de URL:**
```
https://data-api.ecb.europa.eu/service/data/{flow}/{key}?format=jsondata&compressed=false
```

**Documentación:**
- https://data.ecb.europa.eu/help/api/data
- https://sdw-wsrest.ecb.europa.eu/help/

**Indicadores que usan ECB:**
- `EU_GDP_QOQ`: Flow `MNA`, Key `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N`
- `EU_GDP_YOY`: Flow `MNA`, Key `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N` (calculado YoY desde QoQ)
- `EU_CPI_YOY`: Flow `ICP`, Key `M.U2.Y.000000.3.INX`
- `EU_CPI_CORE_YOY`: Flow `ICP`, Key `M.U2.Y.XEF000.3.INX`
- `EU_UNEMPLOYMENT`: Flow `STS`, Key `M.I8.S.UNEH.RTT000.4.000`
- `EU_ECB_RATE`: Flow `FM`, Key `M.ECB.EUR.MRR_FR.LEV`

**Archivo de implementación:** `lib/datasources/ecb.ts`

**Problemas encontrados:**
- La API cambió de endpoint en Oct 2025
- Algunos keys pueden estar incorrectos (GDP, Unemployment, ECB Rate no funcionan)
- Timeouts aumentados a 20 segundos

---

### 2. **DBnomics**

**URL Base:** `https://api.db.nomics.world/v22`

**Formato de URL:**
```
https://api.db.nomics.world/v22/series/{provider}/{dataset}/{series}
```

**Documentación:**
- https://docs.db.nomics.world/web-api/
- https://db.nomics.world/

**Indicadores que usan DBnomics:**
- `EU_RETAIL_SALES_YOY`: Provider `Eurostat`, Dataset `sts_trtu_m`, Series `M.CAL_ADJ.SA.TRTU.TOT.NS.0000.EA19`
- `EU_INDUSTRIAL_PRODUCTION_YOY`: Provider `Eurostat`, Dataset `sts_inpr_m`, Series `M.CAL_ADJ.SA.INPR.TOT.NS.0000.EA19`
- `EU_CONSUMER_CONFIDENCE`: Provider `Eurostat`, Dataset `ei_bsco_m`, Series `M.BAL.M.NSA.EC.ECI.EA19`

**Archivo de implementación:** `lib/datasources/dbnomics.ts`

**Problemas encontrados:**
- Algunos códigos de series pueden estar incorrectos
- Necesita verificación manual en https://db.nomics.world/

---

### 3. **Trading Economics**

**URL Base:** `https://api.tradingeconomics.com`

**Formato de URL:**
```
https://api.tradingeconomics.com/{endpoint}?c={api_key}
```

**Documentación:**
- https://tradingeconomics.com/api
- Requiere API key (variable: `TRADING_ECONOMICS_API_KEY`)

**Indicadores que usan Trading Economics:**
- `EU_PMI_MANUFACTURING`: Series `eurozone-pmi-manufacturing`
- `EU_PMI_SERVICES`: Series `eurozone-pmi-services`
- `EU_PMI_COMPOSITE`: Series `eurozone-pmi-composite`
- `EU_ZEW_SENTIMENT`: Series `eurozone-zew-economic-sentiment`

**Archivo de implementación:** `packages/ingestors/tradingeconomics.ts`

**Problemas encontrados:**
- Requiere `TRADING_ECONOMICS_API_KEY` configurada
- Si no está configurada, los indicadores se saltan con warning

---

## 📁 Archivos de Configuración

### `config/european-indicators.json`
Este archivo contiene la configuración de todos los indicadores europeos:
- IDs de indicadores
- Fuentes de datos (ECB, DBnomics, Trading Economics)
- Códigos de series/keys
- Frecuencias
- Categorías

**Ubicación:** `/config/european-indicators.json`

---

## 🔧 Endpoint de Ingestión

### `/api/jobs/ingest/european`
Este endpoint lee `config/european-indicators.json` y:
1. Para cada indicador, llama a la función de fetch correspondiente (ECB, DBnomics, Trading Economics)
2. Convierte los datos a formato `MacroSeries`
3. Guarda en la base de datos usando `upsertMacroSeries()`

**Archivo:** `app/api/jobs/ingest/european/route.ts`

**Para ejecutar manualmente:**
```bash
curl -X POST http://localhost:3000/api/jobs/ingest/european \
  -H "Authorization: Bearer YOUR_CRON_TOKEN"
```

---

## 🗄️ Base de Datos

**Tabla:** `macro_observations`
- `series_id`: ID del indicador (ej: `EU_CPI_YOY`)
- `date`: Fecha de la observación
- `value`: Valor numérico

**Verificación de datos:**
```sql
SELECT series_id, COUNT(*) as count, MAX(date) as last_date 
FROM macro_observations 
WHERE series_id LIKE 'EU_%' 
GROUP BY series_id;
```

---

## 🐛 Problema Actual: Datos No Aparecen en UI

**Lo que sabemos:**
1. ✅ Los datos están en la base de datos
2. ✅ Los datos llegan correctamente hasta `getDashboardData()`
3. ✅ El JSON del endpoint `/api/debug/dashboard-data` muestra los datos correctamente
4. ❌ Los datos NO aparecen en la interfaz del dashboard

**Posibles causas:**
1. **Problema de serialización:** Los datos se pierden al pasar del servidor al cliente
2. **Problema de filtrado:** El componente React filtra incorrectamente los datos
3. **Problema de renderizado:** Los datos están pero no se renderizan
4. **Problema de caché:** Next.js está cacheando una versión antigua sin los datos

**Próximos pasos sugeridos:**
1. Verificar los logs del servidor cuando se carga el dashboard
2. Verificar si hay errores en la consola del navegador
3. Probar limpiar la caché de Next.js: `rm -rf .next`
4. Verificar si hay algún filtro o condición que excluya los indicadores europeos

---

## 📝 Notas Adicionales

- Los indicadores europeos usan el prefijo `eu_` en los keys (minúsculas)
- En `getMacroDiagnosis()`, los keys se transforman a `EU_*` (mayúsculas)
- `buildIndicatorRows()` debería usar `originalKey` para mantener `eu_*`
- Las categorías pueden tener problemas de encoding (normalización aplicada)

---

## 🔗 Enlaces Útiles

- **ECB Data Portal:** https://data.ecb.europa.eu/
- **DBnomics:** https://db.nomics.world/
- **Trading Economics:** https://tradingeconomics.com/
- **Eurostat:** https://ec.europa.eu/eurostat

---

**Última actualización:** 2025-12-08
