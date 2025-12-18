# 📊 Análisis Completo del Estado del Dashboard Macro

**Fecha:** 2025-12-17  
**Objetivo:** Detectar errores, incoherencias y faltas de datos para dejar el dashboard 100% operativo

---

## 1️⃣ Cobertura de Datos Macro

### 📈 Resumen Global

| Región | Indicadores Mapeados | Con Datos | Cobertura Real | Estado |
|--------|---------------------|-----------|----------------|--------|
| **USD** | 19 | 16 (84%) | ⚠️ Media | Algunos obsoletos |
| **EUR** | 13 | 13 (100%) | ⚠️ Media | Datos obsoletos |
| **GBP** | 11 | 0 (0%) | 🔴 Crítico | **Sin datos** |
| **JPY** | 12 | 0 (0%) | 🔴 Crítico | **Sin datos** |
| **AUD** | 0 | 0 | 🔴 Crítico | **Sin mapeo** |

### ✅ Indicadores que SÍ están llegando correctamente

#### USD (16/19 con datos)
- ✅ **PAYEMS** (NFP) - Reciente
- ✅ **UNRATE** (Tasa desempleo) - Reciente
- ✅ **ICSA** (Initial Claims) - Reciente
- ✅ **JTSJOL** (JOLTS) - Reciente
- ✅ **FEDFUNDS** (Fed Funds Rate) - Reciente
- ✅ **T10Y2Y** (Yield Curve) - Reciente
- ✅ **USPMI** (ISM Manufacturing) - Reciente
- ✅ **USPMI_SERVICES** (ISM Services) - Reciente
- ✅ **HOUST** (Housing Starts) - Reciente
- ✅ **PERMIT** (Building Permits) - Reciente
- ✅ **UMCSENT** (Michigan Sentiment) - Reciente
- ✅ **NFIB** (Small Business) - Reciente
- ⚠️ **CPIAUCSL** (CPI) - Obsoleto (>90 días)
- ⚠️ **CPILFESL** (Core CPI) - Obsoleto (>90 días)
- ⚠️ **PCEPILFE** (Core PCE) - Obsoleto (>90 días)
- ⚠️ **PPIACO** (PPI) - Obsoleto (>90 días)
- ⚠️ **GDPC1** (GDP) - Muy obsoleto (8.5 meses)
- ⚠️ **INDPRO** (Industrial Production) - Obsoleto (>90 días)
- ❌ **RSXFS** (Retail Sales) - Sin datos

#### EUR (13/13 con datos, pero 6 obsoletos)
- ✅ **EU_CPI_YOY** - Reciente
- ✅ **EU_CPI_CORE_YOY** - Reciente
- ✅ **EU_UNEMPLOYMENT** - Reciente
- ✅ **EU_PMI_COMPOSITE** - Reciente
- ✅ **EU_PMI_MANUFACTURING** - Reciente
- ✅ **EU_PMI_SERVICES** - Reciente
- ✅ **EU_CONSUMER_CONFIDENCE** - Reciente
- ⚠️ **EU_ECB_RATE** - Obsoleto (6 meses)
- ⚠️ **EU_GDP_QOQ** - Obsoleto (5.5 meses)
- ⚠️ **EU_GDP_YOY** - Obsoleto (5.5 meses)
- ⚠️ **EU_INDUSTRIAL_PRODUCTION_YOY** - Obsoleto (3.5 meses)
- ⚠️ **EU_RETAIL_SALES_YOY** - Obsoleto (3.5 meses)
- ⚠️ **EU_ZEW_SENTIMENT** - Muy obsoleto (11.5 meses)

### 🔴 Indicadores NO conectados o con valores nulos

#### GBP (11 indicadores - 0% cobertura)
**Todos los indicadores están mapeados pero NO hay datos en BD:**
- ❌ UK_GDP_QOQ
- ❌ UK_GDP_YOY
- ❌ UK_CPI_YOY
- ❌ UK_CORE_CPI_YOY
- ❌ UK_PPI_OUTPUT_YOY
- ❌ UK_UNEMPLOYMENT_RATE
- ❌ UK_AVG_EARNINGS_YOY
- ❌ UK_SERVICES_PMI
- ❌ UK_MANUFACTURING_PMI
- ❌ UK_RETAIL_SALES_YOY
- ❌ UK_BOE_RATE

**Causa:** No existe pipeline de ingesta para UK o no está activo.

#### JPY (12 indicadores - 0% cobertura)
**Todos los indicadores están mapeados pero NO hay datos en BD:**
- ❌ JP_GDP_QOQ
- ❌ JP_GDP_YOY
- ❌ JP_CPI_YOY
- ❌ JP_CORE_CPI_YOY
- ❌ JP_PPI_YOY
- ❌ JP_UNEMPLOYMENT_RATE
- ❌ JP_JOB_TO_APPLICANT_RATIO
- ❌ JP_TANKAN_MANUFACTURING
- ❌ JP_SERVICES_PMI
- ❌ JP_INDUSTRIAL_PRODUCTION_YOY
- ❌ JP_RETAIL_SALES_YOY
- ❌ JP_BOJ_RATE

**Causa:** No existe pipeline de ingesta para JP o no está activo.

#### AUD (0 indicadores - 0% cobertura)
**No hay mapeo en `currency-indicators.json`:**
- ❌ Sin indicadores mapeados

**Causa:** AUD no está configurado en el sistema.

### ⚠️ Indicadores desactualizados (>90 días)

**USD (6 indicadores):**
- CPIAUCSL, CPILFESL, PCEPILFE, PPIACO: Último dato 2025-09-01 (3.5 meses)
- GDPC1: Último dato 2025-04-01 (8.5 meses) ⚠️ **Muy obsoleto**
- INDPRO: Último dato 2025-09-01 (3.5 meses)

**EUR (6 indicadores):**
- EU_ECB_RATE: Último dato 2025-06-11 (6 meses)
- EU_GDP_QOQ, EU_GDP_YOY: Último dato 2025-07-01 (5.5 meses)
- EU_INDUSTRIAL_PRODUCTION_YOY, EU_RETAIL_SALES_YOY: Último dato 2025-09-01 (3.5 meses)
- EU_ZEW_SENTIMENT: Último dato 2024-01-03 (11.5 meses) ⚠️ **Muy obsoleto**

### 🔍 Diagnóstico de Cobertura Baja

#### Problemas de Datos (No de Lógica)

1. **GBP y JPY: 0% cobertura**
   - **Causa:** Falta de fuentes de datos (no hay jobs de ingesta activos)
   - **Evidencia:** Todos los indicadores están mapeados en `currency-indicators.json` pero no hay datos en BD
   - **Solución:** Activar/crear jobs `/api/jobs/ingest/uk` y `/api/jobs/ingest/jp`

2. **AUD: Sin mapeo**
   - **Causa:** No está configurado en `currency-indicators.json`
   - **Solución:** Añadir indicadores AUD o remover AUD del cálculo

3. **Datos obsoletos USD/EUR**
   - **Causa:** Jobs de ingesta no se ejecutan regularmente o fallan
   - **Solución:** Revisar y corregir pipelines de ingesta FRED y European

#### Problemas de Mapeo

**Ninguno detectado.** El mapeo en `currency-indicators.json` y `MAP_KEY_TO_WEIGHT_KEY` está correcto.

#### Problemas de Lógica de Cálculo

**Ninguno detectado.** La lógica de cobertura (`buildCurrencyFeaturePack`, `calcCurrencyRegimeWithCoverage`) está correctamente implementada con umbrales:
- `MIN_COVERAGE = 0.3` (30%)
- `MIN_PRESENT = 3` (mínimo 3 indicadores)

---

## 2️⃣ Régimen Actual del Mercado (Global)

### 📊 Estado Actual

**Régimen mostrado:** Calculado desde `getBiasState()` → `getRiskAppetite()`

**Indicadores que participan:**
- **USD Score:** Calculado desde indicadores USD (16/19 disponibles)
- **Quad Score:** Calculado desde GDP + CPI (parcialmente obsoletos)
- **Liquidity Score:** Calculado desde yield curve y spreads
- **Credit Score:** Calculado desde spreads crediticios
- **Risk Score:** Agregado de los anteriores

### ✅ Coherencia con Datos Actuales

**Estado:** ⚠️ **Parcialmente coherente**

**Razones:**
1. **USD Score:** Basado en 16/19 indicadores (84% cobertura), pero algunos clave (CPI, GDP) están obsoletos
2. **Quad Score:** Depende de GDP (obsoleto 8.5 meses) y CPI (obsoleto 3.5 meses)
3. **Liquidity/Credit:** Basados en datos más recientes (yield curve, spreads)

### 🔍 Estabilidad y Sensibilidad

**Estabilidad:** ⚠️ **Moderadamente estable**

- **Resistente a:** Faltantes de indicadores menores (PMI, sentiment)
- **Sensible a:** Faltantes de indicadores clave (GDP, CPI, NFP)

**Fallback implementado:**
- Si faltan indicadores, el sistema usa los disponibles
- No hay error silencioso: si no hay datos suficientes, el régimen puede ser "Neutral" o "Mixed"

### ⚠️ Problemas Detectados

1. **GDP obsoleto (8.5 meses)**
   - **Impacto:** Quad Score puede estar desactualizado
   - **Solución:** Actualizar pipeline FRED para GDP

2. **CPI obsoleto (3.5 meses)**
   - **Impacto:** Quad Score y USD Score parcialmente desactualizados
   - **Solución:** Actualizar pipeline FRED para CPI

3. **No hay validación de "datos suficientes" para régimen global**
   - **Impacto:** El régimen puede calcularse con datos parcialmente obsoletos
   - **Solución:** Añadir validación similar a regímenes por moneda (MIN_COVERAGE)

---

## 3️⃣ Regímenes Macro por Moneda ⚠️ PRIORITARIO

### 📊 Estado por Moneda

| Moneda | Régimen Actual | Cobertura | Indicadores Presentes | Indicadores Faltantes | Estado |
|--------|----------------|-----------|------------------------|----------------------|--------|
| **USD** | Calculado | 84% (16/19) | 16 | 3 (RSXFS, CPIAUCSL obsoleto, GDPC1 obsoleto) | ✅ Funcional |
| **EUR** | Calculado | 100% (13/13) | 13 | 0 (pero 6 obsoletos) | ⚠️ Funcional con datos obsoletos |
| **GBP** | `insufficient_data` | 0% (0/11) | 0 | 11 (todos) | 🔴 **Sin datos** |
| **JPY** | `insufficient_data` | 0% (0/12) | 0 | 12 (todos) | 🔴 **Sin datos** |
| **AUD** | `insufficient_data` | 0% (0/0) | 0 | 0 (sin mapeo) | 🔴 **Sin mapeo** |

### 🔍 Análisis Detallado por Moneda

#### USD (Estados Unidos)

**Indicadores requeridos (19):**
- ✅ **Inflation (4):** CPIAUCSL, CPILFESL, PCEPILFE, PPIACO
- ✅ **Growth (7):** GDPC1, INDPRO, RSXFS, USPMI, USPMI_SERVICES, HOUST, PERMIT
- ✅ **Labor (4):** PAYEMS, UNRATE, ICSA, JTSJOL
- ✅ **Monetary (2):** FEDFUNDS, T10Y2Y
- ✅ **Sentiment (2):** UMCSENT, NFIB

**Estado:** ✅ **Funcional**
- **Cobertura:** 16/19 (84%) > 30% ✅
- **Presentes:** 16 > 3 ✅
- **Régimen calculado:** Normalmente (reflation/stagflation/recession/goldilocks/mixed)

**Problemas:**
- ⚠️ RSXFS sin datos (pero no crítico, hay otros indicadores de growth)
- ⚠️ CPIAUCSL, GDPC1 obsoletos (pero hay otros indicadores de inflation/growth)

#### EUR (Eurozona)

**Indicadores requeridos (13):**
- ✅ **Inflation (2):** EU_CPI_YOY, EU_CPI_CORE_YOY
- ✅ **Growth (7):** EU_GDP_QOQ, EU_GDP_YOY, EU_INDUSTRIAL_PRODUCTION_YOY, EU_RETAIL_SALES_YOY, EU_PMI_COMPOSITE, EU_PMI_MANUFACTURING, EU_PMI_SERVICES
- ✅ **Labor (1):** EU_UNEMPLOYMENT
- ✅ **Monetary (1):** EU_ECB_RATE
- ✅ **Sentiment (2):** EU_CONSUMER_CONFIDENCE, EU_ZEW_SENTIMENT

**Estado:** ⚠️ **Funcional con datos obsoletos**
- **Cobertura:** 13/13 (100%) > 30% ✅
- **Presentes:** 13 > 3 ✅
- **Régimen calculado:** Normalmente

**Problemas:**
- ⚠️ 6 indicadores obsoletos (>90 días): EU_ECB_RATE, EU_GDP_QOQ, EU_GDP_YOY, EU_INDUSTRIAL_PRODUCTION_YOY, EU_RETAIL_SALES_YOY, EU_ZEW_SENTIMENT
- **Impacto:** Régimen puede estar basado en datos parcialmente obsoletos

#### GBP (Reino Unido)

**Indicadores requeridos (11):**
- ❌ **Inflation (3):** UK_CPI_YOY, UK_CORE_CPI_YOY, UK_PPI_OUTPUT_YOY
- ❌ **Growth (5):** UK_GDP_QOQ, UK_GDP_YOY, UK_SERVICES_PMI, UK_MANUFACTURING_PMI, UK_RETAIL_SALES_YOY
- ❌ **Labor (2):** UK_UNEMPLOYMENT_RATE, UK_AVG_EARNINGS_YOY
- ❌ **Monetary (1):** UK_BOE_RATE

**Estado:** 🔴 **Sin datos suficientes**
- **Cobertura:** 0/11 (0%) < 30% ❌
- **Presentes:** 0 < 3 ❌
- **Régimen:** `insufficient_data` (correcto según lógica)

**Causa:** **Problema de datos, NO de lógica**
- Todos los indicadores están mapeados en `currency-indicators.json`
- No hay datos en BD (jobs de ingesta UK no activos o no existen)

**Solución:**
1. Verificar si existe `/api/jobs/ingest/uk`
2. Si existe, activarlo y ejecutarlo
3. Si no existe, crearlo usando fuentes UK (ONS, BoE)

#### JPY (Japón)

**Indicadores requeridos (12):**
- ❌ **Inflation (3):** JP_CPI_YOY, JP_CORE_CPI_YOY, JP_PPI_YOY
- ❌ **Growth (6):** JP_GDP_QOQ, JP_GDP_YOY, JP_INDUSTRIAL_PRODUCTION_YOY, JP_RETAIL_SALES_YOY, JP_TANKAN_MANUFACTURING, JP_SERVICES_PMI
- ❌ **Labor (2):** JP_UNEMPLOYMENT_RATE, JP_JOB_TO_APPLICANT_RATIO
- ❌ **Monetary (1):** JP_BOJ_RATE

**Estado:** 🔴 **Sin datos suficientes**
- **Cobertura:** 0/12 (0%) < 30% ❌
- **Presentes:** 0 < 3 ❌
- **Régimen:** `insufficient_data` (correcto según lógica)

**Causa:** **Problema de datos, NO de lógica**
- Todos los indicadores están mapeados en `currency-indicators.json`
- No hay datos en BD (jobs de ingesta JP no activos o no existen)

**Solución:**
1. Verificar si existe `/api/jobs/ingest/jp`
2. Si existe, activarlo y ejecutarlo
3. Si no existe, crearlo usando fuentes JP (BoJ, Statistics Bureau)

#### AUD (Australia)

**Indicadores requeridos:** 0 (no mapeados)

**Estado:** 🔴 **Sin mapeo**
- **Cobertura:** 0/0 (indefinido)
- **Régimen:** `insufficient_data` (correcto según lógica)

**Causa:** **Problema de configuración, NO de lógica**
- AUD no está en `currency-indicators.json`
- No hay mapeo de indicadores AUD

**Solución:**
1. **Opción A:** Añadir indicadores AUD a `currency-indicators.json`:
   - AU_CPI_YOY, AU_CORE_CPI_YOY (RBA)
   - AU_GDP_QOQ, AU_GDP_YOY (ABS)
   - AU_UNEMPLOYMENT_RATE (ABS)
   - AU_RBA_RATE (RBA)
   - AU_PMI_MANUFACTURING, AU_PMI_SERVICES
2. **Opción B:** Remover AUD del cálculo de regímenes si no hay datos disponibles

### ✅ Lógica de Cobertura (Funciona Correctamente)

**Umbrales implementados:**
- `MIN_COVERAGE = 0.3` (30% mínimo)
- `MIN_PRESENT = 3` (mínimo 3 indicadores)

**Validación:**
- ✅ GBP: 0% < 30% → `insufficient_data` ✅ Correcto
- ✅ JPY: 0% < 30% → `insufficient_data` ✅ Correcto
- ✅ AUD: Sin mapeo → `insufficient_data` ✅ Correcto
- ✅ USD: 84% > 30% → Régimen calculado ✅ Correcto
- ✅ EUR: 100% > 30% → Régimen calculado ✅ Correcto

**Conclusión:** La lógica de cobertura funciona correctamente. Los "sin datos suficientes" son **justificados técnicamente** porque:
1. GBP/JPY: No hay datos en BD (problema de ingesta)
2. AUD: No hay mapeo (problema de configuración)

### 🎯 Propuestas de Solución

#### Prioridad 1 (Crítico): Activar ingesta UK/JP

**Acción:**
1. Verificar existencia de jobs:
   - `/api/jobs/ingest/uk`
   - `/api/jobs/ingest/jp`
2. Si existen pero no están activos:
   - Activar en cron jobs
   - Ejecutar manualmente para poblar datos históricos
3. Si no existen:
   - Crear jobs usando fuentes oficiales:
     - UK: ONS (Office for National Statistics), BoE
     - JP: BoJ (Bank of Japan), Statistics Bureau

**Impacto:** Resolverá GBP y JPY "insufficient_data"

#### Prioridad 2 (Alto): Decidir sobre AUD

**Acción:**
1. Evaluar si hay fuentes de datos AUD disponibles
2. Si hay:
   - Añadir mapeo en `currency-indicators.json`
   - Crear job de ingesta `/api/jobs/ingest/au`
3. Si no hay:
   - Remover AUD del cálculo de regímenes (no mostrar en UI)

**Impacto:** Eliminará AUD "insufficient_data" o lo removerá del sistema

#### Prioridad 3 (Medio): Actualizar datos obsoletos

**Acción:**
1. Revisar pipelines de ingesta:
   - `/api/jobs/ingest/fred` (para USD)
   - `/api/jobs/ingest/european` (para EUR)
2. Verificar por qué no se actualizan:
   - Errores en jobs
   - Fuentes no disponibles
   - Frecuencia de ejecución incorrecta
3. Corregir y ejecutar manualmente

**Impacto:** Mejorará precisión de regímenes USD y EUR

---

## 4️⃣ Escenarios Institucionales

### 📊 Estado Actual

**Escenarios activos:** Calculados desde `getInstitutionalScenarios()`

**Lógica:**
1. Filtra pares tácticos con dirección clara (BUY/SELL) y confianza Alta/Media
2. Aplica filtro según `usdBias`:
   - USD Fuerte → Solo SELL
   - USD Débil → Solo BUY
   - USD Neutral → Solo Alta confianza (si hay)
3. Separa en:
   - **Activos:** Confianza Alta
   - **Watchlist:** Confianza Media

### ✅ Indicadores que Activan Escenarios

**Escenarios se activan desde:**
- **Pares tácticos** (`biasState.tableTactical`)
- **Confianza** calculada desde:
  - Régimen macro global
  - USD bias
  - Correlaciones
  - Scores por moneda

**No hay indicadores directos** que activen escenarios. Los escenarios son **derivados** de:
1. Sesgo macro de cada par (calculado desde `currencyScores`)
2. Confianza (calculada desde `confidenceFrom()`)
3. Filtro de usdBias

### 🔍 Coherencia con Régimen Macro Global

**Estado:** ✅ **Coherente**

**Razones:**
1. Escenarios se filtran según `usdBias` (USD Fuerte/Débil/Neutral)
2. Confianza se calcula desde régimen global
3. Pares tácticos se calculan desde `currencyScores` (coherente con regímenes por moneda)

### ⚠️ Problemas Detectados

1. **Escenarios pueden no activarse si:**
   - No hay pares con dirección clara (todos "Rango/táctico")
   - Confianza es siempre "Baja"
   - Filtro de usdBias elimina todos los escenarios

2. **Escenarios pueden activarse con datos incompletos:**
   - Si un par tiene sesgo pero su régimen por moneda es `insufficient_data`, el escenario puede activarse igual
   - **Ejemplo:** GBPUSD puede tener escenario aunque GBP tenga `insufficient_data`

**Solución propuesta:**
- Añadir validación: No mostrar escenarios para pares donde alguna moneda tiene `insufficient_data`

### ✅ Escenarios que SÍ se Activan

**Condiciones:**
- Par tiene dirección clara (BUY/SELL)
- Confianza Alta o Media
- Cumple filtro de usdBias

**Ejemplo:**
- EURUSD con sesgo BUY, confianza Alta, USD Débil → Escenario activo

### 🔴 Escenarios que NO se Activan (Esperado)

**Condiciones:**
- Par sin dirección clara ("Rango/táctico")
- Confianza Baja
- No cumple filtro de usdBias

**Ejemplo:**
- Par con sesgo neutral → No aparece en escenarios (correcto)

---

## 5️⃣ Tabla de Indicadores Macro

### 📊 Lista Completa de Indicadores Mostrados

**Secciones:**
1. **EUROZONA:** Indicadores `eu_*` (14 indicadores según `european-indicators.json`)
2. **GLOBAL/USA:** Indicadores no-europeos (resto)

### ✅ Indicadores con Estado OK

**Criterio:** Tienen datos recientes (<90 días) y se usan en cálculos

**USD:**
- PAYEMS, UNRATE, ICSA, JTSJOL, FEDFUNDS, T10Y2Y, USPMI, USPMI_SERVICES, HOUST, PERMIT, UMCSENT, NFIB

**EUR:**
- EU_CPI_YOY, EU_CPI_CORE_YOY, EU_UNEMPLOYMENT, EU_PMI_COMPOSITE, EU_PMI_MANUFACTURING, EU_PMI_SERVICES, EU_CONSUMER_CONFIDENCE

### ⚠️ Indicadores Sin Datos

**USD:**
- RSXFS (Retail Sales) - Sin datos

**GBP (todos):**
- UK_GDP_QOQ, UK_GDP_YOY, UK_CPI_YOY, UK_CORE_CPI_YOY, UK_PPI_OUTPUT_YOY, UK_UNEMPLOYMENT_RATE, UK_AVG_EARNINGS_YOY, UK_SERVICES_PMI, UK_MANUFACTURING_PMI, UK_RETAIL_SALES_YOY, UK_BOE_RATE

**JPY (todos):**
- JP_GDP_QOQ, JP_GDP_YOY, JP_CPI_YOY, JP_CORE_CPI_YOY, JP_PPI_YOY, JP_UNEMPLOYMENT_RATE, JP_JOB_TO_APPLICANT_RATIO, JP_TANKAN_MANUFACTURING, JP_SERVICES_PMI, JP_INDUSTRIAL_PRODUCTION_YOY, JP_RETAIL_SALES_YOY, JP_BOJ_RATE

### ⚠️ Indicadores Desactualizados (>90 días)

**USD:**
- CPIAUCSL, CPILFESL, PCEPILFE, PPIACO (3.5 meses)
- GDPC1 (8.5 meses)
- INDPRO (3.5 meses)

**EUR:**
- EU_ECB_RATE (6 meses)
- EU_GDP_QOQ, EU_GDP_YOY (5.5 meses)
- EU_INDUSTRIAL_PRODUCTION_YOY, EU_RETAIL_SALES_YOY (3.5 meses)
- EU_ZEW_SENTIMENT (11.5 meses)

### 📅 Última Fecha de Actualización por Indicador

**No hay tracking individual** de última actualización por indicador en la UI.

**Solución propuesta:**
- Añadir columna "Última actualización" en tabla de indicadores
- Mostrar badge "Desactualizado" si >90 días (ya implementado con `isStale`)

### 🔍 Indicadores Visibles que NO se Usan en Cálculos

**Criterio:** Indicadores con `weight = 0` o sin mapeo en `WEIGHTS`

**Estado:** ✅ **Filtrado correctamente**

**Lógica implementada:**
- Solo se muestran indicadores con `weight > 0` en `WEIGHTS`
- **Excepción:** Indicadores europeos (`eu_*`) siempre se muestran aunque `weight = 0`

**Conclusión:** No hay indicadores visibles que no se usen (excepto europeos por diseño)

---

## 6️⃣ Tabla de Pares Tácticos

### 📊 Construcción de Pares

**Lógica:** `getBiasTableTactical()` → `getBiasTableFromUniverse()`

**Proceso:**
1. Obtiene universo de pares desde `tactical-pairs.json`
2. Calcula sesgo macro desde:
   - `currencyScores` (scores por moneda)
   - Régimen global (Risk ON/OFF)
   - USD bias
3. Calcula confianza desde:
   - Score macro global
   - USD bias
   - Correlaciones
4. Filtra según:
   - `tactical-pairs.json` (solo pares permitidos)
   - `FOREX_WHITELIST` (para pares Forex)

### ✅ Pares con Régimen Válido

**Criterio:** Ambas monedas tienen régimen calculado (no `insufficient_data`)

**Pares válidos:**
- **EURUSD:** EUR ✅ + USD ✅
- **GBPUSD:** GBP ❌ + USD ✅ → **Problema**
- **USDJPY:** USD ✅ + JPY ❌ → **Problema**
- **AUDUSD:** AUD ❌ + USD ✅ → **Problema**

### ⚠️ Pares con Datos Insuficientes

**Pares afectados:**
- **GBPUSD, EURGBP, GBPJPY:** GBP tiene `insufficient_data`
- **USDJPY, EURJPY, GBPJPY:** JPY tiene `insufficient_data`
- **AUDUSD, EURAUD, GBPAUD:** AUD tiene `insufficient_data`

**Impacto:**
- Sesgo macro puede estar basado en solo una moneda
- Confianza puede ser incorrecta
- Drivers pueden estar incompletos

### 🔍 Inconsistencias Detectadas

#### 1. Pares se Muestran Aunque Macro Subyacente Incompleto

**Problema:**
- GBPUSD se muestra aunque GBP tiene `insufficient_data`
- El sesgo se calcula solo desde USD (parcial)

**Solución propuesta:**
- Añadir validación: No mostrar pares donde alguna moneda tiene `insufficient_data`
- O mostrar con badge "Datos incompletos"

#### 2. Inconsistencia entre Régimen por Moneda y Par Táctico

**Ejemplo:**
- EUR tiene régimen "Goldilocks"
- USD tiene régimen "Reflation"
- EURUSD debería tener sesgo BUY (EUR más fuerte)
- Pero si el cálculo usa solo USD, puede tener sesgo incorrecto

**Solución propuesta:**
- Usar `currencyRegimes` en cálculo de sesgo (ya implementado parcialmente)
- Validar coherencia: Si base > quote en régimen, sesgo debería ser BUY

#### 3. Drivers Pueden Estar Incompletos

**Problema:**
- `buildDriversForPair()` usa `currencyRegimes`
- Si un régimen es `insufficient_data`, el driver no se genera

**Solución propuesta:**
- Añadir driver genérico: "Datos insuficientes para [moneda]"

### ✅ Pares Correctamente Construidos

**Pares con ambas monedas válidas:**
- **EURUSD:** EUR ✅ + USD ✅ → Sesgo correcto
- **EURCHF:** EUR ✅ + CHF (si tiene datos) → Sesgo correcto

---

## 📋 Resumen Ejecutivo

### ✅ Lo que Funciona Bien

1. **Lógica de cobertura:** Correctamente implementada con umbrales (30%, 3 indicadores)
2. **Regímenes USD/EUR:** Funcionales aunque con datos parcialmente obsoletos
3. **Validación de "insufficient_data":** Correcta para GBP/JPY/AUD
4. **Tabla de indicadores:** Filtrado correcto, muestra datos disponibles
5. **Escenarios institucionales:** Lógica coherente con régimen global

### 🔴 Problemas Críticos

1. **GBP/JPY: 0% cobertura** → Problema de datos (jobs de ingesta no activos)
2. **AUD: Sin mapeo** → Problema de configuración
3. **Datos obsoletos USD/EUR** → Problema de ingesta (jobs no actualizan)

### ⚠️ Problemas Menores

1. **Pares tácticos se muestran con macro incompleto** → Problema de validación
2. **No hay tracking de última actualización por indicador** → Problema de visualización
3. **Régimen global no valida cobertura mínima** → Problema de lógica

### 🎯 Plan de Acción Prioritario

#### Prioridad 1 (Crítico - Esta Semana)
1. ✅ Verificar/crear jobs de ingesta UK/JP
2. ✅ Ejecutar ingesta completa para poblar datos históricos
3. ✅ Decidir sobre AUD (mapear o remover)

#### Prioridad 2 (Alto - Esta Semana)
1. ✅ Revisar y corregir pipelines de ingesta FRED/European
2. ✅ Ejecutar ingesta para actualizar datos obsoletos
3. ✅ Añadir validación: No mostrar pares con `insufficient_data`

#### Prioridad 3 (Medio - Próximas 2 Semanas)
1. ✅ Añadir columna "Última actualización" en tabla de indicadores
2. ✅ Añadir validación de cobertura mínima para régimen global
3. ✅ Mejorar drivers para pares con datos incompletos

---

## 🔍 Conclusión

**Estado General:** ⚠️ **Funcional pero con problemas de datos**

**Problemas principales:**
- **Datos:** GBP/JPY sin datos, USD/EUR parcialmente obsoletos
- **Configuración:** AUD sin mapeo
- **Validación:** Pares tácticos no validan cobertura completa

**Lógica:** ✅ **Correcta** - Los "sin datos suficientes" son técnicamente justificados

**Siguiente paso:** Activar ingesta UK/JP y actualizar datos obsoletos USD/EUR
