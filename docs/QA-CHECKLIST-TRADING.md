# Checklist de QA - Dashboard Macro Trading

**Objetivo**: Validar que el dashboard macro está funcionando correctamente en producción y que los cálculos/feeds están "vivos".

**Tiempo estimado**: 10-15 minutos

---

## 1. Cobertura de Datos

### ✅ Qué tiene que estar bien

- **Cobertura temporal**: Últimos 30/90/365 días (según diseño) sin "huecos" raros
- **Cobertura por moneda**: USD/EUR/GBP + (si aplica) JPY/CHF, etc.
- **Cobertura por categoría**: Inflación, crecimiento, empleo, tipos, crédito, riesgo
- **Freshness (CRÍTICO)**: "Última actualización" reciente y coherente con el cron
  - Si cron corre cada hora → no puede decir "hace 2 días"
  - Timestamp debe ser visible y actualizado

### 🚩 Red Flags (algo falla)

- % de cobertura alta pero paneles vacíos
- Fechas "pegadas" (todo se actualiza el mismo día) → ingesta parcial
- Muchos `null` en actual/previous y el dashboard no lo refleja (debería mostrar "—" consistentemente)
- Timestamp de última actualización > 24 horas (si cron es diario) o > 2 horas (si cron es horario)

### 🧪 Prueba Rápida

1. **Filtro "últimos 7 días"**: Debe haber algo casi siempre (aunque sea poco)
2. **Cambiar moneda USD → EUR → GBP**: No puede quedarse con los mismos valores/clusters
3. **Verificar timestamp**: Debe ser reciente (dentro de la ventana del cron)

### 📊 JSON/API a Revisar

```bash
# Verificar cobertura
GET /api/dashboard
# Esperado: {
#   "data": {
#     "indicators": [...],
#     "lastUpdate": "2025-12-17T23:00:00Z",  // Reciente
#     "coverage": {
#       "US": { "total": 17, "withData": 17, "percentage": 100 },
#       "EU": { "total": 12, "withData": 12, "percentage": 100 },
#       ...
#     }
#   }
# }
```

---

## 2. Régimen Actual del Mercado

### ✅ Qué tiene que estar bien

- El régimen (Risk-on / Risk-off / Inflationary / Disinflation / Growth scare / Stagflation, etc.) debe:
  - Tener una **fecha/hora de cálculo** visible
  - Tener **confianza o score** (ej. 0.75, "High", etc.)
  - Ser **consistente con los inputs** (rates, inflación, crecimiento, riesgo)
- Los inputs deben ser visibles (aunque sea como mini tarjetas)

### 🚩 Red Flags

- Régimen cambia cada refresh sin que cambien inputs → bug de normalización o ventanas
- Régimen "Unknown" o "Neutral" permanente → algún input clave está `null` y el modelo cae a default
- Régimen dice "Risk-on" pero spreads/volatilidad están altos → incoherencia
- Timestamp de cálculo ausente o muy antiguo

### 🧪 Prueba Rápida

1. **Revisar inputs visibles**: Si el régimen dice "Risk-on" pero spreads/volatilidad están altos, hay incoherencia
2. **Refresh múltiple**: El régimen NO debe cambiar si los inputs no cambian
3. **Verificar timestamp**: Debe ser reciente (dentro de la última hora si el cron es horario)

### 📊 JSON/API a Revisar

```bash
# Verificar régimen actual
GET /api/dashboard?section=regime
# Esperado: {
#   "regime": {
#     "type": "Risk-on" | "Risk-off" | "Inflationary" | ...,
#     "confidence": 0.75,
#     "calculatedAt": "2025-12-17T23:00:00Z",
#     "inputs": {
#       "rates": {...},
#       "inflation": {...},
#       "growth": {...},
#       "risk": {...}
#     }
#   }
# }
```

---

## 3. Regímenes Macro por Moneda (USD/EUR/GBP)

### ✅ Qué tiene que estar bien

- Cada moneda debe tener:
  - **Régimen propio** (ej. USD: "restrictive + disinflation"; EUR: "weak growth"; etc.)
  - **Drivers**: Inflación, crecimiento, empleo, política monetaria
  - **Fuente/serie y última fecha** para cada driver
- Los regímenes deben ser **diferentes** entre monedas (no clonados)

### 🚩 Red Flags

- EUR y GBP muestran **exactamente el mismo régimen y mismos drivers** → mapping de país/moneda mal hecho
- Alemania/España se mezclan como "Euro Area" sin control → promedio o fallback mal configurado
- Drivers con fechas muy antiguas (> 30 días) → ingesta rota
- Drivers con valores `null` sin indicar "—" → UI inconsistente

### 🧪 Prueba Rápida

1. **Cambiar moneda**: Los drivers (no solo el nombre del régimen) deben cambiar
2. **Comparar USD vs EUR vs GBP**: Deben tener drivers diferentes y coherentes con cada economía
3. **Verificar fechas de drivers**: Deben ser recientes (dentro de la última semana para datos mensuales)

### 📊 JSON/API a Revisar

```bash
# Verificar regímenes por moneda
GET /api/dashboard?section=regimes
# Esperado: {
#   "regimes": {
#     "USD": {
#       "type": "Restrictive + Disinflation",
#       "drivers": {
#         "inflation": { "value": 2.1, "date": "2025-12-01", "series": "CPIAUCSL" },
#         "growth": { "value": 2.3, "date": "2025-10-01", "series": "GDPC1" },
#         ...
#       }
#     },
#     "EUR": {
#       "type": "Weak Growth",
#       "drivers": { ... }  // DIFERENTES de USD
#     },
#     "GBP": {
#       "type": "...",
#       "drivers": { ... }  // DIFERENTES de USD y EUR
#     }
#   }
# }
```

---

## 4. Escenarios Institucionales

### ✅ Qué tiene que estar bien

- **Definición clara** del escenario (ej. "Soft landing", "No landing", "Hard landing", "Inflation resurgence")
- **Probabilidades** que:
  - Sumen 100% (o lo indiquen si no lo hacen)
  - Tengan **fecha de actualización**
- **Transiciones**: Histórico de probabilidad o al menos "cambió desde ayer/semana"
- **Coherencia**: Si inputs cambian, las probabilidades deben reflejarlo

### 🚩 Red Flags

- Probabilidades **clavadas** (ej. 25/25/25/25 siempre) → placeholder
- Probabilidades **cambian fuerte** sin cambios en inputs → bug en normalización
- Probabilidades **no suman 100%** (o no lo indican claramente)
- Timestamp ausente o muy antiguo

### 🧪 Prueba Rápida

1. **Forzar rango (7/30 días)**: El escenario debe "recordar" la ventana
2. **Verificar suma**: Probabilidades deben sumar 100% (o indicar claramente si no)
3. **Cambiar inputs**: Si cambias inputs clave, las probabilidades deben ajustarse

### 📊 JSON/API a Revisar

```bash
# Verificar escenarios
GET /api/dashboard?section=scenarios
# Esperado: {
#   "scenarios": {
#     "softLanding": { "probability": 0.45, "updatedAt": "2025-12-17T23:00:00Z" },
#     "noLanding": { "probability": 0.30, "updatedAt": "2025-12-17T23:00:00Z" },
#     "hardLanding": { "probability": "0.15", "updatedAt": "2025-12-17T23:00:00Z" },
#     "inflationResurgence": { "probability": 0.10, "updatedAt": "2025-12-17T23:00:00Z" }
#   },
#   "sum": 1.0,  // O indicar claramente si no suma 100%
#   "lastUpdate": "2025-12-17T23:00:00Z"
# }
```

---

## 5. Indicadores Macro

### ✅ Qué tiene que estar bien

- Para cada indicador:
  - **Valor actual, previo, fecha**
  - **Dirección** (↑/↓) y sorpresa si aplica
  - **Unidad** (%, bps, índice)
- **Visual**: No mezclar unidades ni series con distinta frecuencia sin avisar (mensual vs trimestral)
- **Consistencia**: Si un indicador es YoY, debe estar claramente etiquetado

### 🚩 Red Flags

- "NaN", "Infinity", o porcentajes **absurdos** (ej. 999%)
- **Fechas futuras** en indicadores "actuales"
- **Promedios raros** por mezclar MoM/YoY sin etiqueta
- Valores `null` sin mostrar "—"
- Unidades mezcladas (ej. % con bps sin indicar)

### 🧪 Prueba Rápida

1. **Click/hover para ver detalle**: Debe coincidir con el headline
2. **Verificar unidades**: Todos los indicadores deben tener unidad clara
3. **Verificar fechas**: No deben ser futuras ni muy antiguas (> 90 días para mensuales)
4. **Verificar dirección**: Si el valor sube, la dirección debe ser ↑

### 📊 JSON/API a Revisar

```bash
# Verificar indicadores
GET /api/dashboard?section=indicators
# Esperado: {
#   "indicators": [
#     {
#       "key": "cpi_yoy",
#       "name": "CPI YoY",
#       "value": 2.1,  // NO null, NO NaN, NO Infinity
#       "previous": 2.0,
#       "date": "2025-12-01",  // NO fecha futura
#       "unit": "%",
#       "direction": "up",
#       "surprise": null,
#       "seriesId": "CPIAUCSL"
#     },
#     ...
#   ]
# }
```

---

## 6. Pares Tácticos

### ✅ Qué tiene que estar bien

- Lista de pares (ej. EURUSD, GBPUSD, DXY, USDJPY, etc.) con:
  - **Sesgo** (bull/bear/neutral) basado en macro + régimen
  - **Horizonte** (táctico = semanas/días) y gatillos
  - **"Por qué"**: 2–3 drivers (rates differential, inflación relativa, risk sentiment)
- Los pares deben **cambiar** cuando cambias moneda base o régimen global

### 🚩 Red Flags

- Pone "bullish" en **todo** o "neutral" en **todo** → el sistema no está conectando inputs
- Los pares **no cambian** cuando cambias moneda base → mapping mal
- Drivers ausentes o genéricos (ej. "Market sentiment" sin más detalle)
- Sesgos inconsistentes con el régimen global

### 🧪 Prueba Rápida

1. **Si el régimen global cambia**: Los pares tácticos deberían reflejarlo
2. **Cambiar moneda base**: Los pares deben ajustarse
3. **Verificar drivers**: Cada par debe tener 2-3 drivers específicos y coherentes

### 📊 JSON/API a Revisar

```bash
# Verificar pares tácticos
GET /api/dashboard?section=tactical-pairs
# Esperado: {
#   "pairs": [
#     {
#       "symbol": "EURUSD",
#       "bias": "bullish" | "bearish" | "neutral",
#       "horizon": "tactical",  // semanas/días
#       "triggers": [...],
#       "drivers": [
#         { "type": "rates_differential", "value": "+50 bps", "impact": "positive" },
#         { "type": "inflation_relative", "value": "EUR lower", "impact": "positive" },
#         { "type": "risk_sentiment", "value": "Risk-on", "impact": "positive" }
#       ],
#       "updatedAt": "2025-12-17T23:00:00Z"
#     },
#     ...
#   ],
#   "distribution": {
#     "bullish": 3,
#     "bearish": 2,
#     "neutral": 1
#   }  // NO todo bullish ni todo neutral
# }
```

---

## Orden Óptimo de Revisión (10 minutos)

### 1. Cobertura de Datos (2 min)
**Si falla, todo lo demás es ruido**

- Verificar timestamp de última actualización
- Verificar cobertura por moneda (USD/EUR/GBP)
- Verificar que no haya muchos `null`

### 2. Régimen Actual (2 min)
**Ver si tiene inputs y timestamp**

- Verificar que el régimen tenga timestamp
- Verificar que tenga inputs visibles
- Verificar coherencia entre régimen e inputs

### 3. Regímenes por Moneda (2 min)
**Ver que USD/EUR/GBP no estén clonados**

- Comparar regímenes USD vs EUR vs GBP
- Verificar que los drivers sean diferentes
- Verificar fechas de drivers

### 4. Indicadores Macro (2 min)
**Sanity: unidades, fechas, nulls**

- Verificar que no haya NaN/Infinity
- Verificar unidades consistentes
- Verificar fechas no futuras

### 5. Escenarios Institucionales (1 min)
**Probabilidades y coherencia**

- Verificar que sumen 100%
- Verificar timestamp
- Verificar que no estén clavados

### 6. Pares Tácticos (1 min)
**Explicación + coherencia con régimen**

- Verificar distribución (no todo bullish/neutral)
- Verificar drivers específicos
- Verificar coherencia con régimen global

---

## Comandos Rápidos para Validación

```bash
# 1. Cobertura de datos
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.coverage'

# 2. Régimen actual
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.regime'

# 3. Regímenes por moneda
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.regimes'

# 4. Indicadores macro
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.indicators[] | select(.value == null or .value == "NaN")'

# 5. Escenarios
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.scenarios'

# 6. Pares tácticos
curl -s https://tu-dominio.vercel.app/api/dashboard | jq '.data.tacticalPairs'
```

---

## Capturas/JSON Requeridos para Validación

Para validar al milímetro, necesitamos:

1. **JSON completo de `/api/dashboard`** (o la sección relevante)
2. **Captura de pantalla del dashboard** mostrando:
   - Timestamp de última actualización
   - Régimen actual con inputs
   - Regímenes por moneda
   - Indicadores macro (al menos 5-10)
   - Escenarios con probabilidades
   - Pares tácticos con sesgos

3. **Logs del cron job** (últimas 24 horas) para verificar que está corriendo

---

## Notas Finales

- **Si algo falla en el paso 1 (Cobertura)**: Todo lo demás puede estar roto, priorizar arreglar ingesta
- **Si el régimen es "Unknown" permanente**: Revisar inputs clave (rates, inflación, crecimiento)
- **Si los pares son todos "neutral"**: Revisar conexión entre régimen y pares tácticos
- **Si las probabilidades están clavadas**: Revisar modelo de escenarios
