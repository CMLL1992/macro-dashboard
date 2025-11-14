# 📊 Resumen de Verificación de Datos - Estado Completo

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

## 🎯 Resumen Ejecutivo

Este documento proporciona una verificación completa del estado de recepción de datos de todos los endpoints y APIs externas integradas en el sistema.

---

## 1. ✅ APIs Externas - Indicadores Macroeconómicos

### 1.1 FRED (Federal Reserve Economic Data)
- **Estado:** ✅ **ACTIVO**
- **API Key:** `FRED_API_KEY` (requerida)
- **Endpoint FRED:** `https://api.stlouisfed.org/fred/series/observations`
- **Endpoint Interno:** `/api/fred/[seriesId]`
- **Rate Limit:** 120 requests/minuto (implementado con throttling)
- **Series Ingestionadas:** 14 series principales
  - CPIAUCSL, CPILFESL (CPI)
  - PCEPI, PCEPILFE (PCE)
  - PPIACO (PPI)
  - GDPC1 (GDP)
  - INDPRO, RSXFS (Actividad)
  - PAYEMS, UNRATE, ICSA (Empleo)
  - T10Y2Y, FEDFUNDS (Monetaria)
  - VIXCLS (Volatilidad)
- **Job de Ingesta:** `/api/jobs/ingest/fred` (protegido con CRON_TOKEN)
- **Frecuencia:** Diaria (06:00 UTC vía GitHub Actions)
- **Verificación:**
  ```bash
  curl "https://macro-dashboard-seven.vercel.app/api/fred/CPIAUCSL?observation_start=2024-01-01"
  ```

### 1.2 IMF (International Monetary Fund)
- **Estado:** ✅ **ACTIVO**
- **API Key:** No requerida (público)
- **Endpoint IMF:** `https://dataservices.imf.org/REST/SDMX_JSON/data/{flow}/{key}`
- **Endpoint Interno:** `/api/macro/imf?flow=IFS&key=PCPIPCH.USA.A&freq=A`
- **Formato:** SDMX JSON
- **Ejemplo:**
  ```bash
  curl "https://macro-dashboard-seven.vercel.app/api/macro/imf?flow=IFS&key=PCPIPCH.USA.A&freq=A"
  ```

### 1.3 ECB (European Central Bank)
- **Estado:** ✅ **ACTIVO**
- **API Key:** No requerida (público)
- **Endpoint ECB:** `https://sdw-wsrest.ecb.europa.eu/service/data/{flow}/{key}`
- **Endpoint Interno:** `/api/macro/ecb?flow=EXR&key=D.USD.EUR.SP00.A&freq=D`
- **Formato:** SDMX JSON
- **Ejemplo:**
  ```bash
  curl "https://macro-dashboard-seven.vercel.app/api/macro/ecb?flow=EXR&key=D.USD.EUR.SP00.A&freq=D"
  ```

### 1.4 World Bank
- **Estado:** ✅ **ACTIVO**
- **API Key:** No requerida (público)
- **Endpoint Interno:** `/api/macro/worldbank?country=USA&indicator=FP.CPI.TOTL.ZG`
- **Ejemplo:**
  ```bash
  curl "https://macro-dashboard-seven.vercel.app/api/macro/worldbank?country=USA&indicator=FP.CPI.TOTL.ZG"
  ```

---

## 2. 📈 APIs Externas - Datos de Mercado

### 2.1 Yahoo Finance
- **Estado:** ✅ **ACTIVO**
- **API Key:** No requerida (público, no oficial)
- **Endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- **Uso:** Correlaciones con DXY (EURUSD, GBPUSD, etc.)
- **Rate Limit:** No oficial (implementado con retries)
- **Símbolos Mapeados:** EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, USDCHF, XAUUSD, XAGUSD
- **Implementación:** `lib/correlations/fetch.ts`

### 2.2 Binance
- **Estado:** ✅ **ACTIVO**
- **API Key:** No requerida (público para datos históricos)
- **Endpoint:** `https://api.binance.com/api/v3/klines`
- **Uso:** Precios de BTCUSDT y ETHUSDT para correlaciones
- **Implementación:** `lib/markets/binance.ts`

---

## 3. 🔄 Endpoints Internos de Ingesta

### 3.1 Ingesta de Datos FRED
- **Endpoint:** `POST /api/jobs/ingest/fred`
- **Autenticación:** `CRON_TOKEN` (header `Authorization: Bearer {CRON_TOKEN}`)
- **Función:** Ingresa 14 series de FRED a la base de datos
- **Automatización:**
  - GitHub Actions: Diario a las 06:00 UTC
  - Vercel Cron: Diario a las 00:00 UTC (warmup)
- **Verificación:**
  ```bash
  curl -X POST "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred" \
    -H "Authorization: Bearer ${CRON_TOKEN}"
  ```
- **Respuesta Esperada:**
  ```json
  {
    "success": true,
    "ingested": 14,
    "errors": 0,
    "duration_ms": 5000
  }
  ```

### 3.2 Ingesta de Noticias
- **Endpoint:** `POST /api/news/insert`
- **Autenticación:** `INGEST_KEY` (header `X-INGEST-KEY: {INGEST_KEY}`)
- **Función:** Inserta noticias económicas y dispara notificaciones
- **Campos Requeridos:**
  - `id_fuente`, `fuente`, `titulo`, `impacto`, `published_at`
- **Impacto:** `low`, `med`, `high`
- **Verificación:**
  ```bash
  curl -X POST "https://macro-dashboard-seven.vercel.app/api/news/insert" \
    -H "X-INGEST-KEY: ${INGEST_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "id_fuente": "test-001",
      "fuente": "Test",
      "titulo": "Test News",
      "impacto": "med",
      "published_at": "2024-01-01T00:00:00Z"
    }'
  ```

### 3.3 Ingesta de Calendario
- **Endpoint:** `POST /api/calendar/insert`
- **Autenticación:** `INGEST_KEY` (header `X-INGEST-KEY`)
- **Función:** Inserta eventos del calendario económico

---

## 4. ⚙️ Jobs Automatizados

### 4.1 Cálculo de Correlaciones
- **Endpoint:** `POST /api/jobs/correlations`
- **Autenticación:** `CRON_TOKEN`
- **Función:** Calcula correlaciones de activos con DXY (12m y 3m)
- **Fuentes de Datos:**
  - DXY: FRED (DTWEXBGS) o Yahoo Finance
  - Activos: Yahoo Finance, Binance (BTC/ETH)
- **Frecuencia:** Diaria (06:00 UTC)
- **Verificación:**
  ```bash
  curl -X POST "https://macro-dashboard-seven.vercel.app/api/jobs/correlations" \
    -H "Authorization: Bearer ${CRON_TOKEN}"
  ```

### 4.2 Cálculo de Bias
- **Endpoint:** `POST /api/jobs/compute/bias`
- **Autenticación:** `CRON_TOKEN`
- **Función:** Calcula bias y narrativas basadas en indicadores macro
- **Frecuencia:** Diaria (06:00 UTC)

### 4.3 Narrativa Semanal
- **Endpoint:** `POST /api/jobs/weekly`
- **Autenticación:** `CRON_TOKEN`
- **Función:** Genera narrativa semanal basada en datos macro, noticias y eventos
- **Frecuencia:** Semanal (domingos 17:00 UTC)

---

## 5. 🔐 Variables de Entorno Requeridas

### 5.1 Variables Críticas (Producción)
| Variable | Descripción | Estado | Verificación |
|----------|-------------|--------|--------------|
| `FRED_API_KEY` | API key de FRED | ✅ Requerida | Verificar en Vercel y GitHub Secrets |
| `CRON_TOKEN` | Token para jobs automatizados | ✅ Requerida | Debe coincidir en Vercel y GitHub |
| `INGEST_KEY` | Token para ingesta externa | ✅ Requerida | Debe coincidir en Vercel y GitHub |
| `APP_URL` | URL de la aplicación | ✅ Requerida | `https://macro-dashboard-seven.vercel.app` |

### 5.2 Variables Opcionales (APIs Externas)
| Variable | Descripción | Estado | Uso |
|----------|-------------|--------|-----|
| `FMP_API_KEY` | Financial Modeling Prep | ⚠️ Opcional | Noticias y calendario |
| `FINNHUB_API_KEY` | Finnhub | ⚠️ Opcional | Noticias y calendario |
| `NEWSAPI_KEY` | NewsAPI | ⚠️ Opcional | Noticias (100 req/día gratis) |
| `TRADING_ECONOMICS_API_KEY` | Trading Economics | ⚠️ Opcional | Calendario (usa guest:guest si no está) |

---

## 6. 📊 Verificación de Estado de Datos

### 6.1 Endpoint de Health
- **Endpoint:** `GET /api/health`
- **Función:** Retorna estado de datos en la base de datos
- **Verificación:**
  ```bash
  curl "https://macro-dashboard-seven.vercel.app/api/health"
  ```
- **Respuesta Esperada:**
  ```json
  {
    "hasData": true,
    "observationCount": 5000,
    "biasCount": 100,
    "correlationCount": 50,
    "latestDate": "2024-01-15",
    "health": {
      "hasObservations": true,
      "hasBias": true,
      "observationCount": 5000,
      "biasCount": 100,
      "correlationCount": 50
    }
  }
  ```

### 6.2 Script de Verificación Local
```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
APP_URL="https://macro-dashboard-seven.vercel.app" \
pnpm tsx scripts/check-data-status.ts
```

---

## 7. ✅ Checklist de Verificación

### 7.1 Verificación de Variables de Entorno
- [ ] `FRED_API_KEY` configurada en Vercel
- [ ] `FRED_API_KEY` configurada en GitHub Secrets
- [ ] `CRON_TOKEN` configurado en Vercel
- [ ] `CRON_TOKEN` configurado en GitHub Secrets (mismo valor)
- [ ] `INGEST_KEY` configurado en Vercel
- [ ] `INGEST_KEY` configurado en GitHub Secrets (mismo valor)
- [ ] `APP_URL` configurado correctamente

### 7.2 Verificación de Endpoints FRED
- [ ] `/api/fred/CPIAUCSL` retorna datos
- [ ] `/api/jobs/ingest/fred` ejecuta correctamente con CRON_TOKEN
- [ ] Logs muestran `ingested: 14` sin errores

### 7.3 Verificación de APIs Públicas
- [ ] `/api/macro/imf` retorna datos
- [ ] `/api/macro/ecb` retorna datos
- [ ] `/api/macro/worldbank` retorna datos

### 7.4 Verificación de Datos de Mercado
- [ ] Correlaciones se calculan correctamente (Yahoo Finance)
- [ ] Datos de Binance (BTC/ETH) se obtienen correctamente

### 7.5 Verificación de Estado de Datos
- [ ] `/api/health` retorna `hasData: true`
- [ ] `observationCount > 0`
- [ ] `biasCount > 0`
- [ ] `correlationCount > 0`
- [ ] `latestDate` es reciente (< 7 días)

---

## 8. 🚨 Problemas Comunes y Soluciones

### 8.1 No hay observaciones en la base de datos
**Síntomas:** `observationCount = 0` en `/api/health`

**Causas Posibles:**
- `FRED_API_KEY` no configurada o inválida
- `CRON_TOKEN` incorrecto en GitHub Actions
- Job de ingesta no se está ejecutando

**Solución:**
1. Verificar `FRED_API_KEY` en Vercel y GitHub Secrets
2. Ejecutar manualmente el workflow de GitHub Actions
3. Revisar logs del job `/api/jobs/ingest/fred`

### 8.2 Error 401 Unauthorized en endpoints protegidos
**Síntomas:** `401 Unauthorized` al llamar endpoints con `CRON_TOKEN` o `INGEST_KEY`

**Causas Posibles:**
- Token incorrecto o no configurado
- Header incorrecto (debe ser `Authorization: Bearer {TOKEN}` o `X-INGEST-KEY: {KEY}`)

**Solución:**
1. Verificar que el token en GitHub Secrets sea idéntico al de Vercel
2. Verificar formato del header en la petición

### 8.3 Datos desactualizados
**Síntomas:** `latestDate` es de hace más de 7 días

**Causas Posibles:**
- Jobs automatizados no se están ejecutando
- FRED no ha publicado datos nuevos

**Solución:**
1. Verificar que GitHub Actions se ejecuten diariamente
2. Ejecutar manualmente el workflow
3. Verificar logs de ejecución

### 8.4 Rate Limit de FRED
**Síntomas:** Error 429 en llamadas a FRED

**Causa:** Más de 120 requests/minuto

**Solución:**
- El código ya implementa throttling (500ms entre requests)
- Si persiste, aumentar el intervalo en `lib/fred.ts`

---

## 9. 📝 Comandos de Verificación Rápida

### Verificar Health
```bash
curl "https://macro-dashboard-seven.vercel.app/api/health" | jq
```

### Verificar Endpoint FRED
```bash
curl "https://macro-dashboard-seven.vercel.app/api/fred/CPIAUCSL?observation_start=2024-01-01" | jq '.observations | length'
```

### Verificar IMF
```bash
curl "https://macro-dashboard-seven.vercel.app/api/macro/imf?flow=IFS&key=PCPIPCH.USA.A&freq=A" | jq '.data | length'
```

### Verificar ECB
```bash
curl "https://macro-dashboard-seven.vercel.app/api/macro/ecb?flow=EXR&key=D.USD.EUR.SP00.A&freq=D" | jq '.data | length'
```

### Ejecutar Job de Ingesta FRED (requiere CRON_TOKEN)
```bash
curl -X POST "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred" \
  -H "Authorization: Bearer ${CRON_TOKEN}" | jq
```

---

## 10. 📚 Documentación Relacionada

- **`VERIFICACION-RAPIDA.md`** - Guía rápida paso a paso
- **`COMO-REVISAR-LOGS-WORKFLOWS.md`** - Cómo interpretar logs de GitHub Actions
- **`INTEGRACION-FUENTES-DATOS.md`** - Fuentes de datos integradas
- **`GUIA-DEBUGGING-COMPLETA.md`** - Guía completa de debugging
- **`DATA_SOURCES_REAL.md`** - Estado de datos reales vs simulados

---

## 11. 🔄 Próximos Pasos Recomendados

1. **Verificar Variables de Entorno:**
   - Confirmar que todos los secrets en GitHub sean idénticos a Vercel
   - Verificar que `FRED_API_KEY` sea válida

2. **Ejecutar Jobs Manualmente:**
   - Ejecutar workflow "Daily Macro Jobs" en GitHub Actions
   - Revisar logs detalladamente

3. **Verificar Estado de Datos:**
   - Ejecutar `scripts/check-data-status.ts`
   - Verificar `/api/health` en el navegador

4. **Monitorear Logs:**
   - Revisar logs de Vercel para errores
   - Revisar logs de GitHub Actions para jobs automatizados

---

**Estado General:** ✅ Sistema configurado correctamente  
**Última Verificación:** Pendiente de ejecución manual  
**Recomendación:** Ejecutar workflows y verificar logs
