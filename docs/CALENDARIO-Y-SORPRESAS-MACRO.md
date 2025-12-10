# Calendario Económico y Sorpresas Macro

## 📋 Resumen

Este sistema permite:
1. **Calendario económico:** Eventos programados (qué dato, cuándo, qué se espera)
2. **Releases reales:** Datos publicados vs consenso, cálculo de sorpresas
3. **Impacto en sesgos:** Tracking de cómo los eventos afectan los scores macro

## 🗄️ Tablas

### 1. `economic_events` (Calendario)

Calendario estático/futuro de eventos económicos.

```sql
CREATE TABLE economic_events (
  id INTEGER PRIMARY KEY,
  source_event_id TEXT,              -- ID externo (API de calendario)
  country TEXT NOT NULL,              -- "US", "EU", "GB", etc.
  currency TEXT NOT NULL,             -- "USD", "EUR", "GBP"...
  name TEXT NOT NULL,                 -- "CPI YoY", "Nonfarm Payrolls"
  category TEXT,                      -- "Inflation", "Employment", "Growth", "Rates"
  importance TEXT,                   -- "low" | "medium" | "high"
  
  -- Vínculo con motor macro:
  series_id TEXT,                    -- ej: "CPIAUCSL" (FRED)
  indicator_key TEXT,                -- clave interna: "us_cpi_yoy"
  
  scheduled_time_utc TEXT NOT NULL,  -- ISO string UTC
  scheduled_time_local TEXT,         -- opcional: Europe/Madrid
  
  previous_value REAL,                -- último valor conocido
  consensus_value REAL,               -- expectativa de consenso
  consensus_range_min REAL,          -- opcional
  consensus_range_max REAL,          -- opcional
  
  directionality TEXT,                -- "higher_is_positive" | "lower_is_positive"
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 2. `economic_releases` (Dato Real + Sorpresa)

Cada vez que sale un dato, se crea una fila aquí.

```sql
CREATE TABLE economic_releases (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES economic_events(id),
  
  release_time_utc TEXT NOT NULL,   -- hora real de publicación
  release_time_local TEXT,
  
  actual_value REAL,                 -- valor publicado
  previous_value REAL,               -- reafirmado/revisado
  consensus_value REAL,              -- consenso en el momento del release
  
  surprise_raw REAL,                -- actual - consenso
  surprise_pct REAL,                 -- (actual - consenso) / ABS(consenso) en %
  surprise_score REAL,               -- normalizado [-1,1]
  
  surprise_direction TEXT,           -- "positive" | "negative" (para la moneda)
  
  revision_flag INTEGER DEFAULT 0,   -- 1 si es revisión
  notes TEXT,
  
  created_at TEXT NOT NULL
);
```

### 3. `macro_event_impact` (Impacto en Sesgos - Opcional)

Snapshot del motor macro antes/después del evento.

```sql
CREATE TABLE macro_event_impact (
  id INTEGER PRIMARY KEY,
  release_id INTEGER NOT NULL REFERENCES economic_releases(id),
  
  currency TEXT NOT NULL,            -- USD, EUR...
  total_score_before REAL,           -- score antes del evento
  total_score_after REAL,            -- score después
  regime_before TEXT,                -- reflation, recession...
  regime_after TEXT,
  
  usd_direction_before TEXT,         -- Bullish/Bearish/Neutral
  usd_direction_after TEXT,
  
  created_at TEXT NOT NULL
);
```

## 🔧 Funciones Disponibles

### Calcular Sorpresas

```typescript
import { calculateSurprise } from '@/lib/db/economic-events'

const surprise = calculateSurprise(
  actual: 3.4,           // Valor publicado
  consensus: 3.1,         // Consenso esperado
  'higher_is_positive'    // Direccionalidad
)

// Retorna:
// {
//   surprise_raw: 0.3,
//   surprise_pct: 0.096,      // ~9.6%
//   surprise_score: 0.96,     // Normalizado [-1,1]
//   surprise_direction: 'positive'  // Positivo para la moneda
// }
```

### Crear un Release

```typescript
import { upsertEconomicRelease } from '@/lib/db/economic-events'

const release = await upsertEconomicRelease({
  event_id: 123,
  release_time_utc: '2025-12-09T13:30:00Z',
  release_time_local: '2025-12-09T14:30:00+01:00',
  actual_value: 3.4,
  previous_value: 3.2,
  consensus_value: 3.1,
  directionality: 'higher_is_positive',
  notes: 'CPI sorprendió fuertemente al alza'
})
```

### Obtener Eventos Recientes

```typescript
import { getRecentReleases } from '@/lib/db/economic-events'

const releases = await getRecentReleases({
  hours: 24,
  currency: 'USD',
  importance: 'high',
  min_surprise_score: 0.3
})
```

### Registrar Impacto en Sesgos

```typescript
import { recordMacroEventImpact } from '@/lib/db/economic-events'

await recordMacroEventImpact({
  release_id: 456,
  currency: 'USD',
  total_score_before: 0.15,
  total_score_after: 0.27,
  regime_before: 'mixed',
  regime_after: 'reflation',
  usd_direction_before: 'Neutral',
  usd_direction_after: 'Bullish'
})
```

## 📡 Endpoint `/api/bias` Ampliado

El endpoint ahora incluye:

```json
{
  "regime": { ... },
  "metrics": { ... },
  "table": [ ... ],
  "rows": [ ... ],
  
  "recentEvents": [
    {
      "event_id": 123,
      "release_id": 456,
      "currency": "USD",
      "name": "CPI YoY",
      "category": "Inflation",
      "importance": "high",
      "release_time_utc": "2025-12-09T13:30:00Z",
      "actual": 3.4,
      "consensus": 3.1,
      "previous": 3.2,
      "surprise_raw": 0.3,
      "surprise_pct": 0.096,
      "surprise_score": 0.8,
      "surprise_direction": "positive",
      "linked_series_id": "CPIAUCSL",
      "linked_indicator_key": "us_cpi_yoy",
      "currency_score_before": 0.15,
      "currency_score_after": 0.27,
      "regime_before": "mixed",
      "regime_after": "reflation"
    }
  ],
  
  "meta": {
    "bias_updated_at": "2025-12-09T13:30:05Z",
    "last_event_applied_at": "2025-12-09T13:30:00Z"
  }
}
```

### Filas Tácticas Enriquecidas

Cada fila en `rows` ahora incluye:

```typescript
{
  pair: "EURUSD",
  trend: "Bajista",
  action: "Buscar ventas",
  confidence: "Alta",
  corr12m: 0.65,
  corr3m: 0.45,
  
  // NUEVO:
  last_relevant_event: {
    currency: "USD",
    name: "CPI YoY",
    surprise_direction: "positive",
    surprise_score: 0.8,
    release_time_utc: "2025-12-09T13:30:00Z"
  },
  updated_after_last_event: true  // Si el sesgo ya incorpora el último release
}
```

## 🎯 Casos de Uso

### 1. Ver qué eventos importantes vienen hoy

```typescript
// Query: SELECT * FROM economic_events 
// WHERE scheduled_time_utc >= DATE('now') 
// AND scheduled_time_utc < DATE('now', '+1 day')
// AND importance = 'high'
```

### 2. Ver sorpresas recientes

```typescript
const surprises = await getRecentReleases({
  hours: 24,
  min_surprise_score: 0.5  // Solo sorpresas fuertes
})
```

### 3. Ver cómo un evento afectó el sesgo

```typescript
// Query: SELECT * FROM macro_event_impact 
// WHERE release_id = 456
```

### 4. En el dashboard: ver si el sesgo ya incorpora la última noticia

```typescript
// En cada TacticalBiasRow:
if (row.updated_after_last_event) {
  // ✅ Sesgo actualizado después del último evento
} else {
  // ⚠️ Sesgo puede estar desactualizado
}
```

## 📝 Ejemplo Completo: Insertar Evento y Release

```typescript
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertEconomicRelease, recordMacroEventImpact } from '@/lib/db/economic-events'
import { getMacroDiagnosis } from '@/domain/diagnostic'

// 1. Crear evento en el calendario (una vez)
const db = getUnifiedDB()
await db.prepare(`
  INSERT INTO economic_events (
    country, currency, name, category, importance,
    series_id, indicator_key,
    scheduled_time_utc,
    consensus_value, previous_value,
    directionality
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'US', 'USD', 'CPI YoY', 'Inflation', 'high',
  'CPIAUCSL', 'us_cpi_yoy',
  '2025-12-09T13:30:00Z',
  3.1, 3.2,
  'higher_is_positive'
)

// 2. Cuando sale el dato real
const eventId = 123  // ID del evento creado arriba
const release = await upsertEconomicRelease({
  event_id: eventId,
  release_time_utc: '2025-12-09T13:30:00Z',
  actual_value: 3.4,  // Valor publicado
  previous_value: 3.2,
  consensus_value: 3.1,
  directionality: 'higher_is_positive',
  notes: 'CPI sorprendió fuertemente al alza'
})

// 3. Calcular impacto (opcional, pero recomendado)
const diagnosisBefore = await getMacroDiagnosis()
const usdScoreBefore = diagnosisBefore.currencyScores?.USD?.totalScore ?? null
const usdRegimeBefore = diagnosisBefore.currencyRegimes?.USD?.regime ?? null

// ... actualizar datos macro (job de ingest) ...

const diagnosisAfter = await getMacroDiagnosis()
const usdScoreAfter = diagnosisAfter.currencyScores?.USD?.totalScore ?? null
const usdRegimeAfter = diagnosisAfter.currencyRegimes?.USD?.regime ?? null

await recordMacroEventImpact({
  release_id: release.id,
  currency: 'USD',
  total_score_before: usdScoreBefore,
  total_score_after: usdScoreAfter,
  regime_before: usdRegimeBefore,
  regime_after: usdRegimeAfter,
  usd_direction_before: diagnosisBefore.regime?.usd_direction ?? null,
  usd_direction_after: diagnosisAfter.regime?.usd_direction ?? null,
})
```

## 🔍 Direccionalidad de Eventos

**`higher_is_positive`:** Valores más altos son positivos para la moneda
- Ejemplos: GDP, Retail Sales, Employment (NFP), PMI

**`lower_is_positive`:** Valores más bajos son positivos para la moneda
- Ejemplos: Unemployment Rate, Initial Claims

**Por defecto:** Si no se especifica, se asume `higher_is_positive`

## 📊 Interpretación de Sorpresas

- **`surprise_score` > 0.5:** Sorpresa fuerte positiva
- **`surprise_score` < -0.5:** Sorpresa fuerte negativa
- **`surprise_score` entre -0.3 y 0.3:** Sorpresa moderada

- **`surprise_direction: 'positive'`:** Bueno para la moneda
- **`surprise_direction: 'negative'`:** Malo para la moneda

## 🚀 Próximos Pasos

1. **Crear job de ingest de calendario:** Script que lee de una API de calendario económico y popula `economic_events`
2. **Crear job de ingest de releases:** Script que detecta cuando sale un dato y crea el `economic_release`
3. **Automatizar cálculo de impacto:** Después de cada release importante, recalcular sesgos y guardar impacto
4. **UI en dashboard:** Mostrar eventos recientes y su impacto visualmente

