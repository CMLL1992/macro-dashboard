# 🔄 Reconfiguración del Sistema de Fuentes de Datos

## ✅ Cambios Implementados

### 1️⃣ TradingEconomics - Solo para países FREE

**Países permitidos (plan FREE):**
- ✅ Suecia (SEK)
- ✅ México (MXN)
- ✅ Nueva Zelanda (NZD)
- ✅ Tailandia (THB)

**Países eliminados de TradingEconomics:**
- ❌ Eurozona (EU) - Migrado a Eurostat/ECB
- ❌ USA - Migrado a FRED exclusivamente
- ⚠️ UK y JP - Mantenidos por ahora (verificar si están en plan FREE)

---

### 2️⃣ USA - Todo desde FRED

**Cambios:**
- ✅ Eliminado TradingEconomics del job `/api/jobs/ingest/fred` (PMI USA)
- ✅ PMI USA ahora solo usa Alpha Vantage (si está disponible) o entrada manual
- ✅ Todos los demás indicadores USA ya venían de FRED

**Indicadores USA (todos desde FRED):**
- CPI, Core CPI, PCE, Core PCE
- PPI
- GDP
- NFP (PAYEMS)
- Unemployment (UNRATE)
- Initial Claims (ICSA)
- T10Y2Y (Curva)
- Fed Funds Rate
- VIX

---

### 3️⃣ Eurozona - Migración a Eurostat/ECB

**Nuevo adaptador creado:** `lib/datasources/eurostat.ts`

**Indicadores migrados:**

| Indicador | Fuente Anterior | Fuente Nueva | Dataset/Endpoint |
|-----------|----------------|--------------|------------------|
| **PIB (QoQ/YoY)** | TradingEconomics | **Eurostat** | `nama_10_gdp` |
| **Producción Industrial (YoY)** | ECB SDW | **Eurostat** | `sts_inpr_m` |
| **Retail Sales (YoY)** | ECB SDW | **Eurostat** | `sts_trtu_m` |
| **Inflación (HICP YoY)** | TradingEconomics | **ECB SDW** | `ICP/M.U2.Y.000000.3.INX` |
| **Core CPI YoY** | TradingEconomics | **ECB SDW** | `ICP/M.U2.Y.XEF000.3.INX` |
| **Unemployment** | TradingEconomics | **ECB SDW** | `LFSI/M.I8.S.UNEHRT.TOTAL0.15_74.T` |
| **ECB Rate** | TradingEconomics | **ECB SDW** | `FM/B.U2.EUR.4F.KR.MRR_FR.LEV` |

**Configuración actualizada:** `config/european-indicators.json`

---

### 4️⃣ PMI Eurozona - FRED (Alternativa)

**Cambio:**
- ❌ Eliminado TradingEconomics para PMI Composite Eurozona
- ✅ Usando FRED Business Confidence Indicators como alternativa:
  - **PMI Manufacturing**: `BSCICP02EZM460S` (Business Tendency Surveys - Manufacturing)
  - **PMI Services**: `BVCICP02EZM460S` (Business Tendency Surveys - Services)
  - **PMI Composite**: `BSCICP02EZM460S` (usando Manufacturing como proxy)

**Nota:** Investing.com no tiene API pública, por lo que se usa FRED como alternativa viable.

---

### 5️⃣ Correlaciones - Yahoo Finance Priorizado

**Mapeo actualizado:** `lib/correlations/fetch.ts`

**Símbolos añadidos al mapeo:**
- ✅ `USDCHF` → `USDCHF=X`
- ✅ `DAX` → `^GDAXI`
- ✅ `CAC` → `^FCHI`
- ✅ `FTSE` → `^FTSE`
- ✅ `XAGUSD` → `SI=F` (Silver)
- ✅ `CL` → `CL=F` (Crude Oil)
- ✅ `BZ` → `BZ=F` (Brent)

**Símbolos ya soportados:**
- FX Majors: EURUSD, GBPUSD, AUDUSD, USDJPY, USDCAD, USDCHF, NZDUSD
- Índices: SPX (^GSPC), NDX (^NDX), DAX (^GDAXI), CAC (^FCHI), FTSE (^FTSE)
- Materias primas: XAUUSD (GC=F), XAGUSD (SI=F), CL (CL=F), BZ (BZ=F)
- Cripto: BTC-USD, ETH-USD

**Prioridad de fuentes:**
1. **Base de datos** (asset_prices) - Si hay ≥30 observaciones
2. **Yahoo Finance API** - Fallback automático

---

## 📁 Archivos Modificados

### Nuevos archivos:
- ✅ `lib/datasources/eurostat.ts` - Adaptador Eurostat API
- ✅ `lib/datasources/investing.ts` - Placeholder para Investing.com (no implementado aún)

### Archivos actualizados:
- ✅ `config/european-indicators.json` - Eliminado TE, añadido Eurostat
- ✅ `app/api/jobs/ingest/european/route.ts` - Soporte para source "eurostat", eliminado TE
- ✅ `app/api/jobs/ingest/fred/route.ts` - Eliminado TradingEconomics para PMI USA
- ✅ `app/api/jobs/ingest/pmi/route.ts` - Eliminado TradingEconomics, solo Alpha Vantage
- ✅ `lib/correlations/fetch.ts` - Mapeo Yahoo Finance expandido
- ✅ `config/assets.config.json` - Añadida sección "commodities" con CL=F, BZ=F

---

## 🔧 Configuración de Variables de Entorno

### Variables que YA NO son necesarias (opcional ahora):
- `TRADING_ECONOMICS_API_KEY` - Solo necesaria para países FREE (Suecia, México, NZ, Tailandia)

### Variables que SÍ son necesarias:
- ✅ `FRED_API_KEY` - **OBLIGATORIA** (USA y algunos indicadores Eurozona)
- ✅ `ALPHA_VANTAGE_API_KEY` - Opcional (PMI USA)
- ✅ `TURSO_DATABASE_URL` - Para producción
- ✅ `TURSO_AUTH_TOKEN` - Para producción

---

## 📊 Estado de Fuentes por Región

### 🇺🇸 USA
- **Fuente principal:** FRED (100%)
- **PMI:** Alpha Vantage (si disponible) o Manual
- **TradingEconomics:** ❌ Eliminado

### 🇪🇺 Eurozona
- **PIB:** Eurostat API (`nama_10_gdp`)
- **Producción Industrial:** Eurostat API (`sts_inpr_m`)
- **Retail Sales:** Eurostat API (`sts_trtu_m`)
- **Inflación (HICP):** ECB SDW
- **PMI:** FRED Business Confidence (alternativa)
- **TradingEconomics:** ❌ Eliminado

### 🇬🇧 UK / 🇯🇵 Japón
- **Estado:** Mantenido con TradingEconomics (verificar si están en plan FREE)
- **Acción requerida:** Verificar si UK/JP están disponibles en plan FREE de TE

### 🌍 Otros países (Suecia, México, NZ, Tailandia)
- **Fuente:** TradingEconomics (plan FREE)
- **Estado:** ✅ Mantenido

---

## 🎯 Correlaciones

**Fuente:** Yahoo Finance (priorizada)

**Símbolos soportados:**
- ✅ FX Majors: EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD
- ✅ Índices: SPX, NDX, DAX, CAC, FTSE
- ✅ Materias primas: XAUUSD (GC=F), XAGUSD (SI=F), CL (CL=F), BZ (BZ=F)
- ✅ Cripto: BTC-USD, ETH-USD

**Flujo:**
1. Leer de base de datos (`asset_prices`) si hay ≥30 observaciones
2. Fallback a Yahoo Finance API
3. Auto-construcción de símbolos Yahoo para patrones conocidos (forex, crypto)

---

## ⚠️ Notas Importantes

1. **Eurostat API:**
   - Formato: JSON-stat 2.0
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?format=JSON&lang=EN&geo=EA19&...`
   - No requiere API key (público)
   - Rate limits: Generosos, pero implementar throttling si es necesario

2. **Investing.com PMI:**
   - No implementado (no hay API pública)
   - Alternativa actual: FRED Business Confidence Indicators
   - Para implementar en el futuro: Usar RapidAPI wrapper o scraping controlado

3. **TradingEconomics:**
   - Mantener solo para países FREE (Suecia, México, NZ, Tailandia)
   - Eliminado completamente para Eurozona y USA
   - UK/JP: Verificar si están en plan FREE

---

## 🚀 Próximos Pasos

1. ✅ **Deploy a producción**
2. ✅ **Ejecutar jobs:**
   - `/api/jobs/ingest/european` - Verificar que Eurostat funciona
   - `/api/jobs/ingest/fred` - Verificar que PMI USA funciona sin TE
   - `/api/jobs/correlations` - Verificar que todas las correlaciones se calculan
3. ✅ **Verificar logs** para confirmar que no hay errores
4. ⚠️ **Verificar UK/JP:** Decidir si mantener TE o migrar a otras fuentes

---

## 📝 Checklist de Verificación

- [x] Adaptador Eurostat creado
- [x] `european-indicators.json` actualizado
- [x] Job european actualizado (soporte Eurostat, sin TE)
- [x] Job FRED actualizado (sin TE para PMI USA)
- [x] Job PMI actualizado (sin TE)
- [x] Mapeo Yahoo Finance expandido
- [x] Config assets actualizado (commodities)
- [ ] **PENDIENTE:** Verificar que Eurostat API funciona correctamente
- [ ] **PENDIENTE:** Verificar que todas las correlaciones se calculan
- [ ] **PENDIENTE:** Decidir sobre UK/JP (mantener TE o migrar)
