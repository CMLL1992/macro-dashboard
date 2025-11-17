# Trading Layer: Macro Bias + Price Action Integration

Documentación de la capa de trading que integra sesgo macro con señales técnicas de price action.

## Política del Proyecto

**⚠️ IMPORTANTE: Este proyecto solo genera señales informativas. Nunca ejecuta órdenes automáticamente.**

Toda decisión de trading es responsabilidad del usuario. El sistema proporciona información para ayudar en la toma de decisiones, pero no realiza operaciones automáticas.

## Arquitectura

### 1. Macro Bias

El Macro Bias es un score cuantitativo que evalúa el sesgo direccional de un activo basado en factores macroeconómicos.

#### Inputs

- **Risk Regime**: RISK ON / RISK OFF / NEUTRAL (con intensidad)
- **USD Bias**: STRONG / WEAK / NEUTRAL
- **Inflation Momentum**: Cambio en CPI YoY (3-6 meses)
- **Growth Momentum**: Cambio en IPI/PIB (3-6 meses)
- **External Balance**: Tendencias en trade balance y current account
- **Rates Context**: (Opcional) Real rates y yield curve

#### Scoring

El score se calcula usando pesos específicos por clase de activo:

- **FX**: USD bias (35%), Risk regime (25%), External balance (15%), Inflation (15%), Growth (10%)
- **Index**: Risk regime (40%), Growth (30%), Inflation (15%), USD bias (10%), External balance (5%)
- **Metal**: USD bias (30%), Risk regime (20%), Inflation (25%), External balance (15%), Growth (10%)
- **Crypto**: Risk regime (50%), USD bias (30%), Inflation (10%), Growth (5%), External balance (5%)
- **Energy**: Risk regime (30%), USD bias (20%), Inflation (20%), Growth (20%), External balance (10%)

#### Output

```typescript
interface MacroBias {
  score: number        // [-100, +100]
  direction: 'long' | 'short' | 'neutral'
  confidence: number   // [0, 1]
  drivers: BiasDriver[]
  timestamp: string
  asset: string
}
```

### 2. Price Action Signals

Señales técnicas basadas en price action (D y H4).

#### Tipos de Señales

1. **TREND_CONTINUATION_LONG/SHORT**
   - EMA20 > EMA50 (o viceversa)
   - Estructura de mercado alineada (HH/HL para long, LH/LL para short)

2. **BOS_LONG/SHORT** (Break of Structure)
   - Ruptura de estructura de mercado
   - BOS_LONG: precio rompe por encima del último LH
   - BOS_SHORT: precio rompe por debajo del último HL

3. **PULLBACK_REJECTION_LONG/SHORT**
   - Precio rechaza zona de EMA50 ± ATR
   - Cierre fuera de la zona con dirección alineada

#### Indicadores Utilizados

- **EMA 20/50**: Tendencia
- **ATR(14)**: Volatilidad
- **Market Structure**: Detección de HH/HL/LH/LL
- **Break of Structure**: Detección de rupturas

### 3. Gating Macro → Técnico

Las señales técnicas se "confirman" solo cuando están alineadas con el sesgo macro.

#### Reglas de Gating

1. **Alineación Direccional**:
   - Si `macro.direction === 'long'` y `macro.confidence >= 0.6` → solo señales LONG
   - Si `macro.direction === 'short'` y `macro.confidence >= 0.6` → solo señales SHORT
   - Si `macro.direction === 'neutral'` o `confidence < 0.6` → no se confirman (o baja prioridad)

2. **Confianza Final**:
   ```
   final_confidence = 0.6 * macro_confidence + 0.4 * tech_confidence
   ```

3. **Justificación**:
   - Cada señal confirmada incluye `why[]` con drivers macro + evidencias técnicas

## Endpoints API

### Macro Bias

**GET** `/api/bias/asset?symbol=EURUSD`

Devuelve el Macro Bias completo para un activo.

**Ejemplo:**
```bash
curl "http://localhost:3000/api/bias/asset?symbol=EURUSD"
```

**Respuesta:**
```json
{
  "score": -45.2,
  "direction": "short",
  "confidence": 0.72,
  "drivers": [
    {
      "name": "Risk Regime",
      "weight": 0.25,
      "sign": "negative",
      "value": -60.0,
      "description": "RISK_OFF (intensity: 0.80)"
    },
    {
      "name": "USD Bias",
      "weight": 0.35,
      "sign": "negative",
      "value": -100.0,
      "description": "USD STRONG"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z",
  "asset": "EURUSD"
}
```

### Technical Signals

**GET** `/api/signals/priceaction?symbol=EURUSD&tf=H4`

Devuelve señales técnicas crudas (sin gating macro).

**Query Parameters:**
- `symbol`: Símbolo del activo (ej: EURUSD, GBPUSD, XAUUSD)
- `tf`: Timeframe (`D` o `H4`)

**Ejemplo:**
```bash
curl "http://localhost:3000/api/signals/priceaction?symbol=EURUSD&tf=H4"
```

**Respuesta:**
```json
{
  "signals": [
    {
      "symbol": "EURUSD",
      "timeframe": "H4",
      "type": "TREND_CONTINUATION_LONG",
      "direction": "long",
      "confidence": 0.75,
      "evidence": [
        "EMA20 (1.1050) > EMA50 (1.1020)",
        "Uptrend structure: 3 HH, 2 HL"
      ],
      "time": "2024-01-15T10:30:00Z",
      "price": 1.1065
    }
  ]
}
```

### Confirmed Signals

**GET** `/api/signals/confirmed?symbol=EURUSD&tf=H4`

Devuelve solo señales confirmadas (macro-gated).

**Ejemplo:**
```bash
curl "http://localhost:3000/api/signals/confirmed?symbol=EURUSD&tf=H4"
```

**Respuesta:**
```json
{
  "signals": [
    {
      "symbol": "EURUSD",
      "timeframe": "H4",
      "type": "TREND_CONTINUATION_LONG",
      "direction": "long",
      "final_confidence": 0.68,
      "macro_confidence": 0.72,
      "tech_confidence": 0.75,
      "why": [
        "Risk Regime: RISK_ON (intensity: 0.65)",
        "USD Bias: USD WEAK",
        "EMA20 (1.1050) > EMA50 (1.1020)",
        "Uptrend structure: 3 HH, 2 HL"
      ],
      "time": "2024-01-15T10:30:00Z",
      "price": 1.1065
    }
  ]
}
```

## Universo de Activos

El sistema soporta los siguientes activos (definidos en `config/universe.assets.json`):

- **FX**: EURUSD, GBPUSD, USDJPY, AUDUSD
- **Metales**: XAUUSD
- **Índices**: SPX, NDX
- **Crypto**: BTCUSD
- **Energía**: WTI

Cada activo tiene metadata sobre:
- Clase (fx, index, metal, crypto, energy)
- Sensibilidad al riesgo (risk_on, risk_off, neutral)
- Exposición al USD (long_usd, short_usd, mixed, none)
- Región (para mapear fuentes macro)

## Alertas

El sistema genera alertas cuando:

1. **Cambio de Risk Regime**: RISK ON ↔ RISK OFF
2. **Cambio de USD Bias**: STRONG ↔ WEAK
3. **Nueva Señal Confirmada**: Con `final_confidence >= SIGNAL_MIN_CONFIDENCE`

**GET** `/api/alerts/recent?limit=20`

Obtiene alertas recientes.

## UI: /trade-bias

La página `/trade-bias` proporciona:

1. **Selector de Símbolo**: Elegir activo del universo
2. **Tabs de Timeframe**: Diario (D) o H4
3. **Macro Card**: Gauge de score, dirección, confianza, drivers
4. **Tech Card**: Lista de señales técnicas crudas (últimas 10)
5. **Confirmed Card**: Feed de señales confirmadas con justificación
6. **Policy Banner**: Recordatorio de que son señales informativas

## Ejemplos de Uso

### Caso 1: EURUSD con Risk OFF y USD Strong

- **Macro Bias**: Score negativo, dirección SHORT, confianza alta
- **Señales Técnicas**: Puede haber señales LONG y SHORT
- **Señales Confirmadas**: Solo SHORT (filtradas por gating)

### Caso 2: SPX con Risk ON y Growth Momentum Positivo

- **Macro Bias**: Score positivo, dirección LONG, confianza alta
- **Señales Técnicas**: Varias señales técnicas
- **Señales Confirmadas**: Solo LONG con alta confianza final

## Limitaciones y Notas

1. **Datos de Mercado**: Las señales técnicas actualmente usan datos mock. En producción, integrar con proveedores reales (Binance, Yahoo, etc.)

2. **Resolución Dinámica SDMX**: Algunos indicadores macro pueden requerir resolución dinámica de claves SDMX (pendiente de implementación completa)

3. **Cache**: Los endpoints tienen cache configurado (30 min - 1 hora) para reducir carga

4. **Performance**: TTFB objetivo < 1s con cache caliente

## Automatización (Sprint 4)

El sistema está completamente automatizado usando GitHub Actions y SQLite para persistencia.

### Pipeline Automático

**Diario (06:05 Europe/Madrid)**:
1. Ingesta de datos macro (`/api/jobs/ingest/macro`)
2. Cálculo de bias (`/api/jobs/compute/bias`)
3. Señales técnicas D (`/api/jobs/compute/signals?tf=D`)
4. Confirmación de señales (`/api/jobs/confirm`)
5. Emisión de alertas (`/api/jobs/alerts/emit`)

**H4 (cada 4 horas)**:
1. Señales técnicas H4 (`/api/jobs/compute/signals?tf=H4`)
2. Confirmación de señales (`/api/jobs/confirm`)
3. Emisión de alertas (`/api/jobs/alerts/emit`)

**Semanal (lunes 07:05)**:
1. Mantenimiento: limpieza de datos antiguos, VACUUM (`/api/jobs/maintenance`)

### Persistencia

SQLite almacena:
- `macro_series` y `macro_observations`: Datos macro históricos
- `macro_bias`: Último bias calculado por símbolo
- `tech_signals`: Señales técnicas generadas
- `confirmed_signals`: Señales confirmadas (macro-gated)
- `alerts`: Alertas emitidas
- `job_runs`: Observabilidad de ejecuciones

### Endpoints de Cache

Lectura rápida desde cache (sin recalcular):

- **GET** `/api/cache/bias/:symbol` - Último bias con narrativa
- **GET** `/api/cache/signals/confirmed?symbol=EURUSD&tf=H4` - Señales confirmadas
- **GET** `/api/cache/alerts?since=ISO` - Alertas recientes
- **GET** `/api/cache/pipeline/status` - Estado del pipeline

### Notificaciones

Soporta Telegram y Discord (configurables vía `NOTIFY_CHANNELS`):

- Cambios de régimen (RISK ON ↔ RISK OFF)
- Cambios de sesgo USD
- Nuevas señales confirmadas con alta confianza

### Seguridad

- Todos los endpoints `/api/jobs/*` requieren `Authorization: Bearer ${CRON_TOKEN}`
- Endpoints de cache son públicos pero con rate limiting
- GitHub Actions usa secrets para `CRON_TOKEN` y `APP_URL`

### Scripts de Testing

```bash
# Simular jobs localmente
pnpm job:ingest
pnpm job:bias
pnpm job:signals:d
pnpm job:signals:h4
pnpm job:confirm
pnpm job:alerts
pnpm job:maintenance
```

## Próximos Pasos

- [x] Automatización completa con GitHub Actions
- [x] Persistencia en SQLite
- [x] Notificaciones automáticas
- [ ] Integrar datos de mercado reales (OHLC)
- [ ] Mejorar detección de estructura de mercado
- [ ] Añadir más tipos de señales técnicas
- [ ] Backtesting de señales confirmadas

