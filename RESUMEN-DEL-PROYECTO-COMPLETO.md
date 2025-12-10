# RESUMEN COMPLETO DEL PROYECTO - CÁLCULOS DETALLADOS POR PÁGINA

## ÍNDICE
1. [Visión General](#visión-general)
2. [Página Dashboard (`/dashboard`)](#página-dashboard-dashboard)
3. [Página Correlaciones (`/correlations`)](#página-correlaciones-correlations)
4. [Página Sesgos (`/sesgos`)](#página-sesgos-sesgos)
5. [Página Narrativas (`/narrativas`)](#página-narrativas-narrativas)
6. [Página Noticias (`/noticias`)](#página-noticias-noticias)
7. [Página QA (`/qa`)](#página-qa-qa)
8. [Página Admin (`/admin`)](#página-admin-admin)
9. [Endpoints API](#endpoints-api)
10. [Flujo de Datos Completo](#flujo-de-datos-completo)

---

## VISIÓN GENERAL

**Proyecto:** Macro Dashboard CM11 Trading  
**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS  
**Base de Datos:** SQLite (better-sqlite3)  
**Deployment:** Vercel  
**Node.js:** 20.x (recomendado)  
**Package Manager:** pnpm 10.20.0

**Objetivo:** Dashboard macroeconómico que muestra indicadores clave, calcula sesgos por par de divisas, correlaciones con benchmarks, regímenes macro por moneda, y genera narrativas tácticas para trading.

---

## PÁGINA DASHBOARD (`/dashboard`)

### Archivo: `app/dashboard/page.tsx`

### Flujo de Datos

```
1. getDashboardData() [lib/dashboard-data.ts]
   ↓
2. getBiasState() [domain/macro-engine/bias.ts]
   ↓
3. getMacroDiagnosisWithDelta() [domain/diagnostic.ts]
   ↓
4. getAllLatestFromDBWithPrev() [lib/db/read-macro.ts]
   ↓
5. SQLite: macro_observations + indicator_history
```

### Cálculo Detallado de Indicadores Macro

#### Paso 1: Lectura desde Base de Datos

**Función:** `getAllLatestFromDBWithPrev()` en `lib/db/read-macro.ts`

**Proceso:**
1. Lee `macro_observations` agrupando por `series_id`
2. Para cada serie, obtiene:
   - Último valor (`value_current`) de `indicator_history`
   - Valor anterior (`value_previous`) de `indicator_history`
   - Fecha actual (`date_current`)
   - Fecha anterior (`date_previous`)
3. Aplica transformaciones según el tipo de indicador:
   - **YoY (Year-over-Year):** `((valor_actual / valor_año_anterior) - 1) * 100`
   - **QoQ (Quarter-over-Quarter):** `((valor_trimestre / valor_trimestre_anterior) - 1) * 100`
   - **Delta:** `valor_actual - valor_anterior`
   - **SMA (Simple Moving Average):** Media móvil de N períodos

**Ejemplo para CPI YoY:**
```typescript
// Si CPI en diciembre 2024 = 300 y diciembre 2023 = 290
cpi_yoy = ((300 / 290) - 1) * 100 = 3.45%
```

#### Paso 2: Diagnóstico Macro

**Función:** `getMacroDiagnosis()` en `domain/diagnostic.ts`

**Proceso:**
1. Toma los `LatestPointWithPrev[]` del Paso 1
2. Para cada indicador:
   - **Calcula postura (`postureOf`):** `Hawkish`, `Neutral`, o `Dovish`
   - **Obtiene peso:** De `config/weights.json` usando `MAP_KEY_TO_WEIGHT_KEY`
   - **Calcula tendencia (`calculateTrend`):** Compara `value` vs `value_previous`
   - **Calcula z-score:** Si hay ≥20 observaciones históricas

**Cálculo de Postura (ejemplos):**

```typescript
// CPI YoY (CPIAUCSL)
if (value < 2) return 'Dovish'      // Inflación baja
if (value <= 3) return 'Neutral'    // Inflación moderada
return 'Hawkish'                    // Inflación alta (>3%)

// GDP YoY (GDPC1)
if (value < 1) return 'Dovish'      // Crecimiento débil
if (value <= 2.5) return 'Neutral'  // Crecimiento moderado
return 'Hawkish'                    // Crecimiento fuerte (>2.5%)

// T10Y2Y (Curva de rendimientos)
if (value < 0) return 'Dovish'      // Curva invertida (recesión)
if (value <= 1) return 'Neutral'    // Curva plana
return 'Hawkish'                    // Curva normal (>1%)

// PAYEMS (Nóminas mensuales, en miles)
if (value < 100) return 'Dovish'    // Empleo débil
if (value <= 250) return 'Neutral' // Empleo moderado
return 'Hawkish'                    // Empleo fuerte (>250k)
```

**Cálculo de Tendencia:**

```typescript
// Si value > value_previous → "Mejora"
// Si value < value_previous → "Empeora"
// Si value ≈ value_previous → "Estable"
```

**Cálculo de Z-Score:**

```typescript
// Requiere ≥20 observaciones históricas
mean = promedio de todos los valores históricos
std = desviación estándar
zScore = (valor_actual - mean) / std

// Si zScore > 2 → Valor muy alto (outlier positivo)
// Si zScore < -2 → Valor muy bajo (outlier negativo)
```

#### Paso 3: Construcción de Tabla de Indicadores

**Función:** `buildIndicatorRows()` en `lib/dashboard-data.ts`

**Proceso:**
1. Toma `biasState.table` (array de `BiasRow`)
2. Para cada fila:
   - Mapea `value_previous` → `previous`
   - Mapea `value` → `value`
   - Preserva `trend`, `posture`, `weight`, `date`
   - Determina `section`: `'EUROZONA'` si `originalKey.startsWith('eu_')`, sino `undefined`
3. Filtra indicadores sin peso (`weight > 0`)

**Estructura final de cada fila:**
```typescript
{
  key: string,              // Ej: "CPIAUCSL" o "eu_cpi_yoy"
  label: string,            // Ej: "CPI Interanual (YoY)"
  category: string,         // Ej: "Inflación"
  previous: number | null,  // Valor anterior
  value: number | null,     // Valor actual
  trend: string | null,     // "Mejora" | "Empeora" | "Estable"
  posture: string | null,   // "Hawkish" | "Neutral" | "Dovish"
  weight: number | null,    // Ej: 0.05
  date: string | null,      // Ej: "2024-12-05"
  originalKey?: string,     // Preservado para búsquedas
  unit?: string,            // Ej: "%"
  isStale?: boolean,        // Si el dato está desactualizado
  section?: string          // "EUROZONA" | undefined
}
```

### Cálculo de Regímenes Macro por Moneda

#### Paso 1: Cálculo de Scores por Moneda

**Función:** `computeCurrencyScores()` en `domain/diagnostic.ts`

**Proceso:**
1. Para cada indicador en `items`:
   - Obtiene `currency` y `group` de `config/currency-indicators.json`
   - Calcula contribución: `contrib = numeric × weight`
     - `numeric = +1` si `posture === 'Hawkish'`
     - `numeric = -1` si `posture === 'Dovish'`
     - `numeric = 0` si `posture === 'Neutral'`
   - Acumula por moneda y grupo:
     - `totalScore += contrib`
     - `growthScore += contrib` si `group === 'growth'`
     - `inflationScore += contrib` si `group === 'inflation'`
     - `laborScore += contrib` si `group === 'labor'`
     - `monetaryScore += contrib` si `group === 'monetary'`
     - `sentimentScore += contrib` si `group === 'sentiment'`

**Ejemplo para USD:**
```typescript
// Indicadores USD con peso y postura:
// CPILFESL (Core CPI): weight=0.09, posture='Hawkish' → contrib = +1 × 0.09 = +0.09
// GDPC1: weight=0.10, posture='Hawkish' → contrib = +1 × 0.10 = +0.10
// UNRATE: weight=0.06, posture='Neutral' → contrib = 0 × 0.06 = 0
// FEDFUNDS: weight=0.08, posture='Hawkish' → contrib = +1 × 0.08 = +0.08

// Resultado:
USD.totalScore = +0.27
USD.growthScore = +0.10
USD.inflationScore = +0.09
USD.laborScore = 0
USD.monetaryScore = +0.08
USD.sentimentScore = 0
```

#### Paso 2: Clasificación de Régimen

**Función:** `getRegime(growthScore, inflationScore)` en `domain/diagnostic.ts`

**Umbrales:**
- Crecimiento fuerte: `growthScore > 0.2`
- Crecimiento débil: `growthScore < -0.2`
- Inflación alta: `inflationScore > 0.2`
- Inflación baja: `inflationScore < -0.2`

**Clasificación:**
```typescript
if (growthScore > 0.2 && inflationScore > 0.2) {
  regime = 'reflation'  // Crecimiento fuerte + Inflación alta
  description = 'Reflación (crecimiento fuerte con inflación alta)'
}
else if (growthScore < -0.2 && inflationScore > 0.2) {
  regime = 'stagflation'  // Crecimiento débil + Inflación alta
  description = 'Estanflación (crecimiento débil con inflación alta)'
}
else if (growthScore < -0.2 && inflationScore < -0.2) {
  regime = 'recession'  // Crecimiento débil + Inflación baja
  description = 'Recesión (crecimiento débil con inflación baja)'
}
else if (growthScore > 0.2 && inflationScore < -0.2) {
  regime = 'goldilocks'  // Crecimiento fuerte + Inflación baja
  description = 'Goldilocks (crecimiento sólido con desinflación)'
}
else {
  regime = 'mixed'  // Señales mixtas
  description = 'Señales mixtas'
}
```

**Cálculo de Probabilidad:**
```typescript
magnitude = Math.max(Math.abs(growthScore), Math.abs(inflationScore))
probability = Math.min(1, magnitude / 0.5)

// Ejemplo:
// Si growthScore = 0.18, inflationScore = 0.15
// magnitude = max(0.18, 0.15) = 0.18
// probability = min(1, 0.18 / 0.5) = 0.36 → 36%
```

### Cálculo de Sesgos Tácticos por Par

#### Paso 1: Construcción de Tabla Táctica

**Función:** `getBiasTableTactical()` en `domain/bias.ts`

**Proceso:**
1. Para cada par en el universo (ej: EURUSD, GBPUSD, XAUUSD):
   - Obtiene `currencyScores` de USD, EUR, GBP, JPY, AUD
   - Calcula `pairScore = base.totalScore - quote.totalScore`
   - Determina dirección:
     - Si `pairScore > 0.1` → `trend = 'Alcista'`, `action = 'Buscar compras'`
     - Si `pairScore < -0.1` → `trend = 'Bajista'`, `action = 'Buscar ventas'`
     - Sino → `trend = 'Neutral'`, `action = 'Rango/táctico'`
   - Calcula confianza basada en:
     - Magnitud de `pairScore`
     - Correlación con DXY (`corr12m`, `corr3m`)
     - Régimen macro (`risk`, `usd_direction`)

**Ejemplo para EURUSD:**
```typescript
// Si USD.totalScore = +0.27, EUR.totalScore = -0.15
pairScore = -0.15 - (+0.27) = -0.42

// Como pairScore < -0.1:
trend = 'Bajista'
action = 'Buscar ventas'
confidence = 'Alta'  // Porque |pairScore| > 0.3

// Si corr12m(EURUSD vs DXY) = +0.65 (correlación positiva fuerte)
// Y USD está Bullish → refuerza la señal bajista
```

#### Paso 2: Enriquecimiento con Correlaciones

**Función:** En `domain/macro-engine/bias.ts` (líneas 200-252)

**Proceso:**
1. Obtiene correlaciones desde BD: `getCorrelationsForSymbols(symbols, 'DXY')`
2. Para cada fila táctica:
   - Busca `corr12m` y `corr3m` en el mapa de correlaciones
   - Si existe, actualiza `row.corr12m` y `row.corr3m`
   - Si no existe, mantiene valores existentes (de `corrMap`)

### Cálculo de Régimen Global

**Función:** `getBiasState()` en `domain/macro-engine/bias.ts`

**Componentes:**

1. **USD Bias (`getUSDBias`):**
   ```typescript
   // Normaliza componentes:
   dxyNorm = clamp(dxy / 10, -1, 1)
   curveNorm = clamp((t10y2y - t10y3m) / 1, -1, 1)
   pceNorm = clamp(pce / 5, -1, 1)
   gdpNorm = clamp(gdp / 5, -1, 1)
   
   score = clamp((dxyNorm + curveNorm - pceNorm + gdpNorm) / 4, -1, 1)
   
   // Clasificación:
   if (score > 0.25) regime = 'Bullish'
   else if (score < -0.25) regime = 'Bearish'
   else regime = 'Neutral'
   ```

2. **Quad (`getQuad`):**
   ```typescript
   cpiTrend = deltaOf(cpiRow)  // Cambio en CPI
   gdpTrend = deltaOf(gdpRow)   // Cambio en GDP
   
   if (cpiTrend < 0 && gdpTrend > 0) classification = 'Goldilocks'
   else if (cpiTrend < 0 && gdpTrend < 0) classification = 'Recesivo'
   else if (cpiTrend > 0 && gdpTrend < 0) classification = 'Stagflation'
   else classification = 'Expansivo'
   
   score = clamp((cpiScore + gdpScore) / 2, -1, 1)
   ```

3. **Liquidity (`getLiquidityRegime`):**
   ```typescript
   // Usa WALCL, RRP, TGA, M2
   walclChange = deltaOf(walcl)
   rrpChange = deltaOf(rrp)
   tgaChange = deltaOf(tga)
   m2Trend = deltaOf(m2)
   
   // Clasifica según cambios
   ```

4. **Credit (`getCreditRegime`):**
   ```typescript
   // Usa curva de rendimientos y spreads HY/IG
   yieldCurve = t10y2y
   creditSpreads = hySpread - igSpread
   
   // Clasifica según nivel y cambios
   ```

5. **Risk:**
   ```typescript
   // Combina USD bias, quad, liquidity, credit
   // Clasifica como 'Risk ON' o 'Risk OFF'
   ```

### Renderizado en el Dashboard

**Componentes mostrados:**
1. **Régimen actual:** Muestra `regime.overall`, `regime.usd_direction`, `regime.quad`
2. **Regímenes macro por moneda:** Tarjetas con régimen, probabilidad y descripción
3. **Tabla de indicadores:** Agrupada por sección (EUROZONA vs GLOBAL) y categoría
4. **Tabla táctica:** Componente cliente (`TacticalTablesClient`) con sesgos por par

---

## PÁGINA CORRELACIONES (`/correlations`)

### Archivo: `app/correlations/page.tsx`

### Flujo de Datos

```
1. getCorrelationState() [domain/macro-engine/correlations.ts]
   ↓
2. getRawCorrelations() (prioridad: BD → corrMap → recálculo)
   ↓
3. Construye CorrelationState con points, shifts, summary
```

### Cálculo Detallado de Correlaciones

#### Paso 1: Obtención de Datos

**Función:** `getRawCorrelations()` en `domain/macro-engine/correlations.ts`

**Prioridad de fuentes:**
1. **Base de Datos (`getAllCorrelationsFromDB`):**
   - Lee tabla `correlations` filtrada por `benchmark = 'DXY'`
   - Obtiene `corr3`, `corr6`, `corr12`, `corr24`
   - Retorna `RawCorrelationRecord[]`

2. **CorrMap (`getCorrMap`):**
   - Mapa precalculado en memoria
   - Obtiene `c3`, `c6`, `c12` por símbolo
   - Normaliza símbolos para evitar duplicados

3. **Recálculo (`getCorrelations`):**
   - Último recurso si BD y corrMap fallan
   - Calcula correlaciones on-the-fly (lento)

#### Paso 2: Cálculo de Correlación (si se recalcula)

**Función:** `calculateCorrelation()` en `lib/correlations/calc.ts`

**Proceso:**
1. **Obtiene precios diarios** del activo y benchmark (DXY)
2. **Calcula log returns:**
   ```typescript
   logReturn = Math.log(precio_t / precio_{t-1})
   ```
3. **Alinea series por fecha:**
   - Forward-fill hasta 3 días hábiles
   - Solo incluye fechas donde ambas series tienen datos
4. **Winsoriza returns:**
   - Percentil 1% y 99% para eliminar outliers
5. **Calcula correlación de Pearson:**
   ```typescript
   correlation = Σ((x_i - x̄)(y_i - ȳ)) / √(Σ(x_i - x̄)² × Σ(y_i - ȳ)²)
   ```
6. **Valida tamaño de muestra:**
   - Mínimo 40 observaciones para 3m
   - Mínimo 150 observaciones para 12m

**Ejemplo:**
```typescript
// Precios EURUSD y DXY (últimos 63 días):
// DXY: [100, 101, 102, 101, 100, ...]
// EURUSD: [1.10, 1.09, 1.08, 1.09, 1.10, ...]

// Log returns:
// DXY: [0.01, 0.01, -0.01, -0.01, ...]
// EURUSD: [-0.009, -0.009, 0.009, 0.009, ...]

// Correlación calculada: -0.75 (correlación negativa fuerte)
```

#### Paso 3: Cálculo de Shifts (Cambios de Régimen)

**Función:** En `domain/macro-engine/correlations.ts`

**Proceso:**
1. Para cada símbolo:
   - Obtiene `corr12m` y `corr3m`
   - Calcula `delta = corr12m - corr3m`
   - Clasifica régimen:
     ```typescript
     if (Math.abs(delta) > 0.3) {
       regime = 'Break'  // Cambio significativo
     } else if (delta > 0.1 && corrAbs > 0.5) {
       regime = 'Reinforcing'  // Se fortalece
     } else if (Math.abs(delta) < 0.1) {
       regime = 'Stable'  // Estable
     } else {
       regime = 'Weak'  // Débil
     }
     ```

**Ejemplo:**
```typescript
// EURUSD:
// corr12m = +0.65, corr3m = +0.45
// delta = 0.65 - 0.45 = +0.20
// Como delta > 0.1 y corrAbs > 0.5:
regime = 'Reinforcing'
```

#### Paso 4: Cálculo de Summary

**Función:** En `domain/macro-engine/correlations.ts`

**Proceso:**
1. Para cada símbolo:
   - Determina ventana más fuerte: `max(|corr3m|, |corr12m|)`
   - Calcula tendencia:
     ```typescript
     if (corr3m > corr12m + 0.1) trend = 'Strengthening'
     else if (corr3m < corr12m - 0.1) trend = 'Weakening'
     else trend = 'Stable'
     ```
   - Calcula `macroRelevanceScore`:
     ```typescript
     // Basado en magnitud de correlación y régimen
     score = Math.abs(corrNow) * (regime === 'Break' ? 1.2 : 1.0)
     score = clamp(score, 0, 1)
     ```

### Renderizado en Correlaciones

**Componentes mostrados:**
1. **Contexto macro:** Régimen actual (risk, USD, quad)
2. **Tabla de correlaciones:**
   - Activo, Benchmark, Ventana más fuerte
   - Correlación actual (tooltip con corr3m y corr12m)
   - Tendencia (Strengthening/Weakening/Stable)
   - Régimen (Break/Reinforcing/Stable/Weak)
   - Relevancia macro (barra de progreso 0-100%)

---

## PÁGINA SESGOS (`/sesgos`)

### Archivo: `app/sesgos/page.tsx`

### Flujo de Datos

```
1. getTradingBiasState() [domain/macro-engine/trading-bias.ts]
   ↓
2. getBiasState() + getCorrelationState()
   ↓
3. buildAssetTradingBias() → AssetTradingBias[]
```

### Cálculo Detallado de Sesgos de Trading

#### Paso 1: Inferencia de Side (Long/Short/Neutral)

**Función:** `inferSideFromTacticalRow()` en `domain/macro-engine/trading-bias.ts`

**Proceso:**
```typescript
trend = row.trend.toLowerCase()
action = row.action.toLowerCase()

if (trend.includes('alcista') || action.includes('compr')) {
  return 'Long'
}
if (trend.includes('bajista') || action.includes('vent')) {
  return 'Short'
}
return 'Neutral'
```

#### Paso 2: Cálculo de Convicción

**Función:** `computeConviction()` en `domain/macro-engine/trading-bias.ts`

**Proceso:**
1. Parte de confianza base:
   ```typescript
   if (confidence.includes('alta')) score = 2
   else if (confidence.includes('baja')) score = 0
   else score = 1
   ```

2. Ajusta según correlación:
   ```typescript
   corrAbs = Math.abs(corr12m)
   if (corrAbs > 0.6 && shiftRegime !== 'Break') {
     score += 1  // Correlación fuerte refuerza
   }
   ```

3. Ajusta según régimen de riesgo:
   ```typescript
   if (regime.risk === 'Risk ON' && side === 'Long') {
     score += 1  // Risk ON favorece longs
   }
   if (regime.risk === 'Risk OFF' && side === 'Short') {
     score += 1  // Risk OFF favorece shorts
   }
   ```

4. Penaliza según breaks y contradicciones:
   ```typescript
   if (shiftRegime === 'Break' || shiftRegime === 'Weak') {
     score -= 1  // Correlación débil reduce confianza
   }
   if (regime.risk === 'Risk OFF' && side === 'Long') {
     score -= 1  // Contradicción reduce confianza
   }
   ```

5. Clasifica final:
   ```typescript
   score = clamp(score, 0, 2)
   if (score >= 2) return 'Alta'
   if (score <= 0) return 'Baja'
   return 'Media'
   ```

**Ejemplo:**
```typescript
// EURUSD con:
// confidence = 'Alta' → score = 2
// corr12m = +0.65, shiftRegime = 'Reinforcing' → score += 1 = 3
// regime.risk = 'Risk OFF', side = 'Short' → score += 1 = 4
// clamp(4, 0, 2) = 2 → 'Alta'
```

#### Paso 3: Generación de Narrativa Macro

**Función:** `buildAssetTradingBias()` en `domain/macro-engine/trading-bias.ts`

**Proceso:**
1. Combina información de:
   - `row.motive` (motivo del sesgo táctico)
   - `regime` (usd_direction, quad, liquidity, credit, risk)
   - `shift` (correlación y régimen de shift)
2. Construye texto descriptivo explicando:
   - Por qué el sesgo es Long/Short/Neutral
   - Qué indicadores macro lo respaldan
   - Cómo se relaciona con el régimen actual

#### Paso 4: Cálculo de Risk Flags

**Función:** `deriveRiskFlags()` en `domain/macro-engine/trading-bias.ts`

**Flags generados:**
1. **Risk OFF + Long:**
   ```typescript
   if (regime.risk === 'Risk OFF' && side === 'Long') {
     flags.push({
       id: 'risk_off_environment',
       label: 'Entorno de aversión al riesgo (Risk OFF)',
       severity: 'High'
     })
   }
   ```

2. **Correlation Break:**
   ```typescript
   if (shiftRegime === 'Break') {
     flags.push({
       id: 'correlation_break',
       label: 'Ruptura reciente de correlación con el benchmark',
       severity: 'Medium'
     })
   }
   ```

3. **Confianza Baja:**
   ```typescript
   if (confidence.includes('baja')) {
     flags.push({
       id: 'low_confidence',
       label: 'Confianza baja en la señal táctica',
       severity: 'Low'
     })
   }
   ```

4. **Correlación Débil:**
   ```typescript
   if (!corr12m || Math.abs(corr12m) < 0.3) {
     flags.push({
       id: 'weak_macro_alignment',
       label: 'Alineación macro débil o poco concluyente',
       severity: 'Medium'
     })
   }
   ```

5. **Liquidez Ajustada:**
   ```typescript
   if ((regime.liquidity === 'Low' || regime.liquidity === 'Contracting') && side === 'Long') {
     flags.push({
       id: 'liquidity_tightening',
       label: 'Liquidez ajustada, cuidado con posiciones largas',
       severity: 'Medium'
     })
   }
   ```

6. **Contra-tendencia USD:**
   ```typescript
   if (usdDir === 'Bullish' && side === 'Long' && corr12m > 0.5) {
     flags.push({
       id: 'usd_counter_trend',
       label: 'USD fuerte y activo correlacionado positivamente',
       severity: 'Medium'
     })
   }
   ```

### Renderizado en Sesgos

**Componentes mostrados:**
1. **Régimen global:** overall, risk, USD, quad, liquidity
2. **Tabla de sesgos:**
   - Activo, Sesgo (Long/Short/Neutral)
   - Convicción (Alta/Media/Baja)
   - Narrativa macro (texto descriptivo)
   - Correlación (corr12m con benchmark)
   - Flags de riesgo (badges con severidad)

---

## PÁGINA NARRATIVAS (`/narrativas`)

### Archivo: `app/narrativas/page.tsx`

### Flujo de Datos

```
1. getBiasState() + getCorrelationState()
   ↓
2. buildNarrativeRows() → NarrativeRow[]
   ↓
3. Renderiza grid de tarjetas por activo
```

### Cálculo Detallado de Narrativas

#### Paso 1: Construcción de Filas de Narrativa

**Función:** `buildNarrativeRows()` en `app/narrativas/page.tsx`

**Proceso:**
1. Toma `biasState.tableTactical` y `correlationState.shifts`
2. Para cada fila táctica:
   - Normaliza símbolo: `symbol.replace('/', '').toUpperCase()`
   - Busca shift correspondiente en `correlationShifts`
   - Construye `NarrativeRow`:
     ```typescript
     {
       par: row.pair ?? row.symbol,
       tactico: row.trend ?? 'Neutral',
       accion: row.action ?? 'Rango/táctico',
       confianza: row.confidence ?? 'Media',
       motivo: row.motive ?? 'Sin narrativa disponible.',
       corrRef: shift?.benchmark ?? 'DXY',
       corr12m: row.corr12m ?? shift?.corr12m ?? null,
       corr3m: row.corr3m ?? shift?.corr3m ?? null
     }
     ```

#### Paso 2: Validación de Datos

**Función:** `validateBiasRowFinal()` en `lib/types/bias-final.ts`

**Proceso:**
1. Valida que `symbol`, `trend_final`, `action_final`, `confidence_level`, `motivo_macro` existan
2. Normaliza correlaciones: `null → 0`, `NaN → 0`
3. Retorna objeto validado o error

#### Paso 3: Renderizado de Tarjetas

**Componentes mostrados por tarjeta:**
1. **Header:** Símbolo + badge de tendencia (Alcista/Bajista/Rango)
2. **Narrativa macro:** Texto completo del `motivo`
3. **Acción recomendada:** Badge destacado con `action_final`
4. **Métricas:**
   - Confianza (Alta/Media/Baja) con badge de color
   - Correlación 12m y 3m (formateadas con signo)
   - Referencia (benchmark, típicamente DXY)

### Página de Narrativa Detallada (`/narrativas/[symbol]`)

**Archivo:** `app/narrativas/[symbol]/page.tsx`

**Proceso:**
1. Obtiene `biasState` y `correlationState`
2. Busca fila táctica correspondiente al símbolo
3. Genera narrativa extensa usando `domain/narratives.ts`
4. Muestra:
   - Contexto macro completo
   - Análisis detallado del activo
   - Indicadores clave que respaldan la narrativa
   - Recomendaciones operativas

---

## PÁGINA NOTICIAS (`/noticias`)

### Archivo: `app/noticias/page.tsx`

### Flujo de Datos

```
1. Lee tabla `news` desde SQLite
2. Ordena por fecha descendente
3. Filtra por prioridad/relevancia (opcional)
```

### Estructura de Datos

**Tabla `news`:**
```sql
CREATE TABLE news (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  url TEXT,
  published_at TEXT,
  priority TEXT,
  created_at TEXT
)
```

**Renderizado:**
- Lista cronológica de noticias
- Filtros por fuente y fecha
- Links a URLs originales

---

## PÁGINA QA (`/qa`)

### Archivo: `app/qa/page.tsx`

### Cálculos de Calidad

#### Frescura de Datos

**Función:** `isStaleByFrequency()` en `lib/utils/freshness.ts`

**Proceso:**
1. Determina frecuencia esperada según tipo de indicador:
   ```typescript
   // Diario: SLA = 1 día
   // Semanal: SLA = 7 días
   // Mensual: SLA = 30 días
   // Trimestral: SLA = 90 días
   ```

2. Compara `date` actual con fecha esperada:
   ```typescript
   daysSinceUpdate = (today - date) / (1000 * 60 * 60 * 24)
   isStale = daysSinceUpdate > SLA
   ```

#### Conteo de Nulls

**Proceso:**
1. Cuenta indicadores con `value === null`
2. Calcula porcentaje: `(nulls / total) * 100`
3. Muestra alerta si porcentaje > umbral (ej: 20%)

#### Estado de Jobs

**Proceso:**
1. Verifica última ejecución de jobs:
   - `job:ingest:fred`
   - `job:correlations`
   - `job:bias`
2. Muestra estado: ✅ OK si ejecutado en últimas 24h, ⚠️ Warning si >24h, ❌ Error si >48h

---

## PÁGINA ADMIN (`/admin`)

### Endpoints

1. **`/admin/news`:** CRUD de noticias
2. **`/admin/calendar`:** CRUD de eventos de calendario
3. **`/admin/notifications`:** Gestión de notificaciones

### Funcionalidad

- Crear, editar, eliminar noticias/eventos
- Ver historial de notificaciones
- Configurar parámetros del sistema

---

## ENDPOINTS API

### `/api/jobs/ingest/fred`

**Función:** Ingesta de datos desde FRED API

**Proceso:**
1. Obtiene lista de series desde `config/core-indicators.json`
2. Para cada serie:
   - Llama a FRED API: `https://api.stlouisfed.org/fred/series/observations`
   - Obtiene últimos N puntos (típicamente últimos 2 años)
   - Inserta en `macro_observations`
   - Actualiza `indicator_history` con valores current/previous

**Seguridad:** Requiere header `Authorization: Bearer ${CRON_TOKEN}`

### `/api/jobs/correlations`

**Función:** Calcula correlaciones y guarda en BD

**Proceso:**
1. Obtiene lista de activos desde `config/universe.assets.json`
2. Para cada activo:
   - Obtiene precios históricos (Yahoo Finance, Binance, Stooq)
   - Obtiene precios de DXY (benchmark)
   - Calcula correlación para ventanas 3m, 6m, 12m, 24m
   - Inserta/actualiza en tabla `correlations`

**Seguridad:** Requiere header `Authorization: Bearer ${CRON_TOKEN}`

### `/api/jobs/compute/bias`

**Función:** Recalcula sesgos macro y guarda en BD

**Proceso:**
1. Llama a `getBiasState()`
2. Para cada activo en universo:
   - Calcula sesgo usando `getBiasTableTactical()`
   - Inserta/actualiza en tabla `macro_bias`

**Seguridad:** Requiere header `Authorization: Bearer ${CRON_TOKEN}`

### `/api/bias`

**Función:** Expone estado de bias actual

**Retorna:**
```json
{
  "regime": {
    "overall": "string",
    "usd_direction": "Bullish|Bearish|Neutral",
    "quad": "string",
    "liquidity": "string",
    "credit": "string",
    "risk": "Risk ON|Risk OFF"
  },
  "metrics": {
    "usdScore": number,
    "quadScore": number,
    "liquidityScore": number | null,
    "creditScore": number | null,
    "riskScore": number | null
  },
  "table": BiasRow[],
  "tableTactical": TacticalBiasRow[]
}
```

### `/api/correlations`

**Función:** Expone estado de correlaciones actual

**Retorna:**
```json
{
  "updatedAt": "ISO date string",
  "benchmark": "DXY",
  "windows": ["3m", "6m", "12m", "24m"],
  "points": CorrelationPoint[],
  "shifts": CorrelationShift[],
  "summary": CorrelationSummary[]
}
```

### `/api/health`

**Función:** Health check del sistema

**Proceso:**
1. Verifica acceso a BD
2. Cuenta registros en `macro_observations`, `macro_bias`, `correlations`
3. Retorna estado y conteos

**Retorna:**
```json
{
  "status": "ok|error",
  "database": {
    "observations": number,
    "bias": number,
    "correlations": number
  },
  "timestamp": "ISO date string"
}
```

### `/api/diag`

**Función:** Diagnóstico sin tocar BD

**Proceso:**
1. Llama directamente a FRED API para T10Y2Y, UNRATE, GDPC1
2. Retorna última fecha de ingesta y resultado de warmup

**Útil para:** Aislar problemas de BD vs problemas de red/API

---

## FLUJO DE DATOS COMPLETO

### 1. Ingesta de Datos

```
FRED API / Otras fuentes
    ↓
/api/jobs/ingest/fred
    ↓
lib/db/upsert.ts → upsertMacroObservation()
    ↓
SQLite: macro_observations
    ↓
Actualiza indicator_history (value_current, value_previous, dates)
```

### 2. Cálculo de Correlaciones

```
Precios históricos (Yahoo/Binance/Stooq)
    ↓
/api/jobs/correlations
    ↓
lib/correlations/calc.ts → calculateCorrelation()
    ↓
SQLite: correlations (corr3, corr6, corr12, corr24)
```

### 3. Cálculo de Bias

```
getMacroDiagnosis() → items con posturas y pesos
    ↓
computeCurrencyScores() → scores por moneda
    ↓
getRegime() → regímenes macro por moneda
    ↓
getBiasState() → bias state completo
    ↓
/api/jobs/compute/bias
    ↓
SQLite: macro_bias
```

### 4. Renderizado en Dashboard

```
getDashboardData()
    ↓
getBiasState() + getCorrelationState()
    ↓
buildIndicatorRows() → IndicatorRow[]
    ↓
buildTacticalSafe() → TacticalRowSafe[]
    ↓
detectScenarios() → Scenario[]
    ↓
Renderiza React components
```

---

## ARCHIVOS CLAVE

### Configuración
- `config/weights.json`: Pesos de indicadores
- `config/currency-indicators.json`: Mapeo indicador → moneda/grupo
- `config/core-indicators.json`: Lista de series FRED
- `config/universe.assets.json`: Lista de activos para correlaciones

### Lógica de Negocio
- `domain/diagnostic.ts`: Diagnosis macro, currencyScores, regímenes
- `domain/macro-engine/bias.ts`: Bias state, tabla macro y táctica
- `domain/macro-engine/correlations.ts`: Estado de correlaciones
- `domain/macro-engine/trading-bias.ts`: Sesgos de trading
- `domain/posture.ts`: Cálculo de posturas (Hawkish/Neutral/Dovish)

### Base de Datos
- `lib/db/read-macro.ts`: Lectura de datos macro
- `lib/db/upsert.ts`: Escritura de datos
- `lib/db/schema.ts`: Esquema SQLite

### Utilidades
- `lib/correlations/calc.ts`: Cálculo de correlaciones de Pearson
- `lib/utils/freshness.ts`: Cálculo de frescura de datos
- `lib/dashboard-data.ts`: Construcción de datos del dashboard

---

## CONCLUSIÓN

Este documento describe en detalle cómo se calcula cada componente del dashboard macroeconómico, desde la ingesta de datos hasta el renderizado final. Cada página tiene su propio flujo de datos y cálculos específicos, pero todas comparten la misma base de datos SQLite y los mismos motores de cálculo (`getBiasState`, `getCorrelationState`).

Los cálculos son determinísticos y reproducibles, basados en datos económicos reales y fórmulas estadísticas estándar (correlación de Pearson, z-scores, etc.). Los pesos y umbrales son configurables mediante archivos JSON en `config/`.

