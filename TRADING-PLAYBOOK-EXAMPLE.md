# Trading Playbook - Ejemplo de Respuesta Real

## 📋 Estructura Completa del JSON

```typescript
interface TradingPlaybook {
  regime: string              // "Neutral" | "Risk ON" | "Risk OFF"
  usdDirection: string        // "Débil" | "Fuerte" | "Neutral" | "Bullish" | "Bearish"
  quad: string                // "Expansivo" | "Goldilocks" | "Stagflation" | "Recesivo" | "expansion"
  liquidity: string          // "High" | "Medium" | "Low" | "Contracting"
  credit: string             // "Low" | "Medium" | "Stress High"
  risk: string               // "Risk ON" | "Risk OFF" | "Neutral"
  assets: TradingAssetPlan[]
  updatedAt: string          // ISO 8601 date string
}

interface TradingAssetPlan {
  asset: string              // "EURUSD" | "GBPUSD" | "XAUUSD" | "USDJPY" | "DXY"
  bias: "LONG" | "SHORT" | "NEUTRAL"
  confidence: "low" | "medium" | "high"
  environment: "trend" | "range"
  reasons: string[]          // Array de explicaciones en español
}
```

## 📊 Ejemplo Real (Estado Actual: Neutral, USD Débil, Quad Expansion)

Basado en el estado actual del dashboard (2025-11-17):

```json
{
  "regime": "Neutral",
  "usdDirection": "Débil",
  "quad": "expansion",
  "liquidity": "Medium",
  "credit": "Medium",
  "risk": "Neutral",
  "updatedAt": "2025-11-17T21:00:07.779Z",
  "assets": [
    {
      "asset": "EURUSD",
      "bias": "LONG",
      "confidence": "high",
      "environment": "trend",
      "reasons": [
        "USD débil según régimen macro",
        "Correlación 12m con DXY fuertemente negativa (-0.59)",
        "Correlaciones 12m y 3m alineadas",
        "Cuadrante Expansivo (inflación alta, crecimiento positivo)",
        "Crecimiento desacelerando"
      ]
    },
    {
      "asset": "GBPUSD",
      "bias": "LONG",
      "confidence": "high",
      "environment": "trend",
      "reasons": [
        "USD débil según régimen macro",
        "Correlación 12m con DXY fuertemente negativa (-0.51)",
        "Correlaciones 12m y 3m alineadas",
        "Cuadrante Expansivo (inflación alta, crecimiento positivo)",
        "Crecimiento desacelerando"
      ]
    },
    {
      "asset": "XAUUSD",
      "bias": "NEUTRAL",
      "confidence": "low",
      "environment": "range",
      "reasons": [
        "USD débil según régimen macro",
        "Correlación 12m con DXY negativa moderada (-0.37)",
        "Régimen Risk OFF favorece activos defensivos",
        "Cuadrante Expansivo (inflación alta, crecimiento positivo)",
        "Inflación elevada (CPI: 3.02%) favorece oro",
        "Crecimiento desacelerando"
      ]
    },
    {
      "asset": "USDJPY",
      "bias": "SHORT",
      "confidence": "medium",
      "environment": "trend",
      "reasons": [
        "USD débil según régimen macro",
        "Correlación 12m con DXY positiva moderada (0.43)",
        "Cuadrante Expansivo (inflación alta, crecimiento positivo)",
        "Crecimiento desacelerando"
      ]
    },
    {
      "asset": "DXY",
      "bias": "SHORT",
      "confidence": "high",
      "environment": "trend",
      "reasons": [
        "USD débil según régimen macro",
        "Cuadrante Expansivo (inflación alta, crecimiento positivo)",
        "Crecimiento desacelerando"
      ]
    }
  ]
}
```

## 🔍 Explicación de las Decisiones

### EURUSD → LONG (High Confidence, Trend)
- **Razón principal:** USD débil + correlación negativa fuerte (-0.59)
- **Confianza alta:** Correlación ≥ 0.6 y régimen claro
- **Environment trend:** Correlaciones 12m/3m alineadas, señales claras

### GBPUSD → LONG (High Confidence, Trend)
- **Similar a EURUSD:** USD débil + correlación negativa fuerte (-0.51)
- **Confianza alta:** Correlación ≥ 0.6

### XAUUSD → NEUTRAL (Low Confidence, Range)
- **Razón:** Señales mixtas (USD débil pero régimen Neutral, no Risk OFF)
- **Confianza baja:** No se cumplen condiciones claras para LONG o SHORT
- **Environment range:** Señales contradictorias

### USDJPY → SHORT (Medium Confidence, Trend)
- **Razón:** USD débil → JPY se fortalece → SHORT USDJPY
- **Confianza media:** Correlación positiva moderada (0.43)

### DXY → SHORT (High Confidence, Trend)
- **Razón directa:** USD débil según régimen macro
- **Confianza alta:** Señal directa del régimen

## 🧪 Casos de Prueba Cubiertos

✅ **USD Débil:**
- EURUSD → LONG ✓
- GBPUSD → LONG ✓
- USDJPY → SHORT ✓
- DXY → SHORT ✓

✅ **USD Fuerte:**
- EURUSD → SHORT ✓
- GBPUSD → SHORT ✓
- USDJPY → LONG ✓
- DXY → LONG ✓

✅ **XAUUSD con señales mixtas:**
- Environment → range ✓
- Bias → NEUTRAL ✓

## 🚀 Uso del Endpoint

```bash
# Llamar al endpoint
curl https://macro-dashboard-seven.vercel.app/api/trading-playbook

# Con formato
curl https://macro-dashboard-seven.vercel.app/api/trading-playbook | jq '.'

# Filtrar solo EURUSD
curl https://macro-dashboard-seven.vercel.app/api/trading-playbook | jq '.assets[] | select(.asset == "EURUSD")'
```

## 📝 Notas de Implementación

- **Fuentes de datos:** `getBiasState()` + `getCorrelationState()`
- **Correlaciones:** Prioriza `correlationState.shifts`, fallback a `biasState.tableTactical`
- **Reasons:** Generados automáticamente desde indicadores macro (CPI, GDP, etc.)
- **Confidence:** Basado en fuerza de correlación y claridad del régimen
- **Environment:** Determina si es trend (señales claras) o range (señales mixtas)

