# 📊 Estado Actual del Dashboard Macro
**Fecha:** 2025-11-17 21:00 UTC  
**Última actualización de datos:** 2025-11-14

---

## 📌 1. /api/bias — Régimen y Bias Actuales

### Régimen General
```json
{
  "regime": {
    "overall": "Neutral",
    "usd_direction": "Débil",
    "quad": "expansion"
  },
  "score": -0.295,
  "updatedAt": "2025-11-17T21:00:07.779Z",
  "latestDataDate": "2025-11-14"
}
```

### Scores (parcial - solo usdScore disponible en /api/bias)
```json
{
  "usdScore": -0.295,
  "quadScore": null,  // ⚠️ No disponible en /api/bias actual
  "liquidityScore": null  // ⚠️ No disponible en /api/bias actual
}
```

**Nota:** Los scores completos (quadScore, liquidityScore, creditScore, riskScore) están disponibles en el Macro Engine pero no se exponen en `/api/bias`. Se requiere actualizar el endpoint para incluir `BiasState.metrics` completo.

### Indicadores Clave (3 ejemplos)

#### 1. Curva 10Y-2Y (Spread)
```json
{
  "key": "T10Y2Y",
  "label": "Curva 10Y–2Y (spread %)",
  "value": 0.52,
  "value_previous": 0.52,
  "trend": "Estable",
  "posture": "Neutral",
  "date": "2025-11-14",
  "category": "Financieros / Curva"
}
```

#### 2. PIB Interanual (GDP YoY)
```json
{
  "key": "GDPC1",
  "label": "PIB Interanual (GDP YoY)",
  "value": 2.08,
  "value_previous": 3.84,
  "trend": "Empeora",
  "posture": "Neutral",
  "date": "2025-04-01",
  "category": "Crecimiento / Actividad"
}
```

#### 3. Inflación CPI (YoY)
```json
{
  "key": "CPIAUCSL",
  "label": "Inflación CPI (YoY)",
  "value": 3.02,
  "value_previous": 3.02,
  "trend": "Estable",
  "posture": "Hawkish",
  "date": "2025-09-01",
  "category": "Precios / Inflación"
}
```

---

## 📌 2. Tabla del Dashboard (Macro Indicators)

### Inflación

#### CPI (YoY)
- **Key:** `CPIAUCSL`
- **Valor:** 3.02%
- **Valor anterior:** 3.02%
- **Tendencia:** Estable
- **Postura:** Hawkish
- **Fecha:** 2025-09-01

#### Core CPI (YoY)
- **Key:** `CPILFESL`
- **Valor:** 3.03%
- **Valor anterior:** 3.03%
- **Tendencia:** Estable
- **Postura:** Hawkish
- **Fecha:** 2025-09-01

### Crecimiento

#### PIB Interanual (GDP YoY)
- **Key:** `GDPC1`
- **Valor:** 2.08%
- **Valor anterior:** 3.84%
- **Tendencia:** ⚠️ **Empeora**
- **Postura:** Neutral
- **Fecha:** 2025-04-01

#### PIB Trimestral (GDP QoQ Anualizado)
- **Key:** `GDPC1` (QoQ)
- **Valor:** 3.84%
- **Valor anterior:** 3.84%
- **Tendencia:** Estable
- **Postura:** Hawkish
- **Fecha:** 2025-04-01

#### Producción Industrial (YoY)
- **Key:** `INDPRO`
- **Valor:** 0.87%
- **Valor anterior:** 0.87%
- **Tendencia:** Estable
- **Postura:** Neutral
- **Fecha:** 2025-08-01

#### Ventas Minoristas (YoY)
- **Key:** `RSXFS`
- **Valor:** 4.77%
- **Valor anterior:** 4.77%
- **Tendencia:** Estable
- **Postura:** Hawkish
- **Fecha:** 2025-08-01

### Liquidez

**⚠️ Nota:** M2 (`WM2NS`) no aparece en los resultados actuales. El Macro Engine calcula `liquidityScore` usando WALCL, RRP, TGA, y M2, pero estos indicadores no se muestran individualmente en `/api/bias`.

**Regime de Liquidez:** Disponible en `BiasState.regime.liquidity` (requiere acceso directo al Macro Engine).

### Producción / ISM

#### Producción Industrial (Ya listado arriba)
- **Key:** `INDPRO`
- **Valor:** 0.87% YoY

**⚠️ Nota:** ISM Manufacturing/Services no aparecen en los indicadores actuales. Solo se muestra Producción Industrial.

### Crédito

#### Curva 10Y-2Y (Ya listado arriba)
- **Key:** `T10Y2Y`
- **Valor:** 0.52%
- **Postura:** Neutral

**⚠️ Nota:** High Yield spreads (`BAMLH0A0HYM2EY`) no aparecen en los resultados actuales. El Macro Engine calcula `creditScore` usando spreads y curva, pero no se exponen individualmente.

**Regime de Crédito:** Disponible en `BiasState.regime.credit` (requiere acceso directo al Macro Engine).

### Mercado Laboral

#### Tasa de Desempleo (U3)
- **Key:** `UNRATE`
- **Valor:** 4.3%
- **Valor anterior:** 4.3%
- **Tendencia:** Estable
- **Postura:** Neutral
- **Fecha:** 2025-08-01

#### Nóminas No Agrícolas (NFP Δ)
- **Key:** `PAYEMS`
- **Valor:** 22 (miles)
- **Valor anterior:** 22 (miles)
- **Tendencia:** Estable
- **Postura:** Dovish
- **Fecha:** 2025-08-01

---

## 📌 3. Snapshot del Bias Táctico

### Bias Global

```json
{
  "usd_bias": "Débil",
  "risk_bias": "Neutral",
  "quad": "expansion",
  "liquidity": "Medium",  // ⚠️ Requiere acceso a BiasState completo
  "credit": "Medium",      // ⚠️ Requiere acceso a BiasState completo
  "risk": "Neutral"        // ⚠️ Requiere acceso a BiasState completo
}
```

### Pares Tácticos (Top 5)

#### 1. EUR/USD
- **Sesgo Macro:** USD débil
- **Acción:** Buscar compras
- **Corr 12m:** -0.59
- **Corr 3m:** -0.63

#### 2. GBP/USD
- **Sesgo Macro:** USD débil
- **Acción:** Buscar compras
- **Corr 12m:** -0.51
- **Corr 3m:** -0.62

#### 3. AUD/USD
- **Sesgo Macro:** USD débil
- **Acción:** Buscar compras
- **Corr 12m:** -0.49
- **Corr 3m:** -0.40

#### 4. USD/JPY
- **Sesgo Macro:** USD débil
- **Acción:** Buscar compras (pares con USD al frente)
- **Corr 12m:** 0.43
- **Corr 3m:** 0.55

#### 5. XAU/USD
- **Sesgo Macro:** Neutral
- **Acción:** Rango/táctico
- **Corr 12m:** -0.37
- **Corr 3m:** -0.25

### Activos de Riesgo (RISK OFF)

#### BTC/USDT
- **Sesgo Macro:** RISK OFF
- **Acción:** Buscar ventas
- **Corr 12m:** -0.09
- **Corr 3m:** -0.13

#### ETH/USDT
- **Sesgo Macro:** RISK OFF
- **Acción:** Buscar ventas
- **Corr 12m:** -0.07
- **Corr 3m:** -0.18

#### SPX
- **Sesgo Macro:** RISK OFF
- **Acción:** Buscar ventas
- **Corr 12m:** -0.05
- **Corr 3m:** -0.25

#### NDX
- **Sesgo Macro:** RISK OFF
- **Acción:** Buscar ventas
- **Corr 12m:** -0.05
- **Corr 3m:** -0.22

---

## 📊 Resumen Ejecutivo

### Régimen Actual
- **Overall:** Neutral
- **USD:** Débil
- **Quad:** Expansion
- **Score:** -0.295 (ligeramente negativo)

### Señales Clave
1. **USD Débil** → Sesgo alcista en pares EUR/USD, GBP/USD, AUD/USD
2. **RISK OFF** → Sesgo bajista en activos de riesgo (BTC, ETH, SPX, NDX)
3. **Inflación Estable** → CPI y Core CPI en ~3.02-3.03% (Hawkish)
4. **Crecimiento Desacelerando** → GDP YoY bajó de 3.84% a 2.08% (Empeora)
5. **Laboral Estable** → Desempleo 4.3%, NFP +22k (Dovish)

### Health Check
- ✅ **Observations:** 10,756
- ✅ **Bias Count:** 10
- ✅ **Correlation Count:** 18
- ✅ **Items con valores:** 15/15 (100%)

---

## ⚠️ Limitaciones Actuales

1. **Scores incompletos en `/api/bias`:**
   - Solo expone `usdScore`
   - No expone `quadScore`, `liquidityScore`, `creditScore`, `riskScore`
   - **Solución:** Actualizar `/api/bias` para incluir `BiasState.metrics` completo

2. **Indicadores de Liquidez/Crédito no visibles:**
   - WALCL, RRP, TGA, M2 no aparecen en la tabla
   - High Yield spreads no aparecen
   - **Solución:** Agregar estos indicadores a la tabla del dashboard

3. **ISM no disponible:**
   - Solo se muestra Producción Industrial
   - **Solución:** Agregar ISM Manufacturing/Services si están disponibles

---

## 🔧 Recomendaciones

1. **Actualizar `/api/bias`** para exponer `BiasState` completo:
   ```typescript
   {
     regime: { overall, usd_direction, quad, liquidity, credit, risk },
     metrics: { usdScore, quadScore, liquidityScore, creditScore, riskScore },
     ...
   }
   ```

2. **Agregar indicadores faltantes** a la tabla del dashboard:
   - WALCL, RRP, TGA, M2 (Liquidez)
   - High Yield spreads (Crédito)
   - ISM Manufacturing/Services (si disponibles)

3. **Crear endpoint `/api/bias-state`** que exponga el `BiasState` completo del Macro Engine sin transformaciones.

