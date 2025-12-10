# Configuración de Jobs: Calendario y Releases

## 📋 Resumen

Este documento explica cómo configurar los jobs para mantener el calendario económico y los releases actualizados en tiempo casi real.

## 🔧 Jobs Implementados

### 1. `/api/jobs/ingest/calendar`

**Objetivo:** Poblar/actualizar `economic_events` desde una API externa

**Frecuencia recomendada:**
- **1 vez al día** (por la noche, ej: 02:00 UTC) para toda la semana
- **Opcional:** Refresco cada 4-6 horas para cambios de consenso, horarios, etc.

**Cron sugerido:**
```bash
# Cada día a las 02:00 UTC
0 2 * * * curl -X POST https://tuapp.vercel.app/api/jobs/ingest/calendar \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Qué hace:**
1. Llama a `fetchFromCalendarAPI()` (implementar según tu API)
2. Para cada evento, mapea a configuración interna (`mapExternalEventToInternal`)
3. Upserta en `economic_events` usando `source_event_id` como clave única

**TODO: Implementar `fetchFromCalendarAPI()`**

Ejemplo de implementación:
```typescript
async function fetchFromCalendarAPI(params: { from: Date; to: Date }): Promise<ExternalEvent[]> {
  // Ejemplo con TradingEconomics API
  const response = await fetch(
    `https://api.tradingeconomics.com/calendar?c=${API_KEY}&d1=${params.from.toISOString()}&d2=${params.to.toISOString()}`
  )
  const data = await response.json()
  
  return data.map((ev: any) => ({
    id: ev.CalendarId,
    country: ev.Country,
    currency: ev.Currency,
    name: ev.Event,
    category: ev.Category,
    importance: ev.Importance === 'High' ? 'high' : ev.Importance === 'Medium' ? 'medium' : 'low',
    scheduled_time_utc: ev.Date,
    previous: ev.Previous,
    consensus: ev.Forecast,
    consensus_range_min: ev.ForecastLow,
    consensus_range_max: ev.ForecastHigh,
  }))
}
```

### 2. `/api/jobs/ingest/releases`

**Objetivo:** Cuando llega la hora de un dato, mirar la API, guardar el release, calcular sorpresa y disparar recomputo de bias

**Frecuencia recomendada:**
- **Cada minuto** durante horas de mercado (ej: 08:00-20:00 UTC)
- Solo procesa eventos en ventana pequeña: `[now - 2m, now + 1m]`

**Cron sugerido:**
```bash
# Cada minuto durante horas de mercado (08:00-20:00 UTC)
* 8-20 * * * curl -X POST https://tuapp.vercel.app/api/jobs/ingest/releases \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Qué hace:**
1. Busca eventos sin release en ventana `[now - 2m, now + 1m]` con `importance >= 'medium'`
2. Para cada evento, llama a `fetchReleaseFromCalendarAPI()` para obtener dato real
3. Si el dato está disponible:
   - Crea `economic_release` con sorpresa calculada
   - Registra impacto en `macro_event_impact` (before/after scores)
   - Recomputa bias y correlaciones
4. Retorna número de releases creados

**TODO: Implementar `fetchReleaseFromCalendarAPI()`**

Ejemplo de implementación:
```typescript
async function fetchReleaseFromCalendarAPI(event: EventWithoutRelease): Promise<{
  actual: number | null
  previous: number | null
  consensus: number | null
  time: string
} | null> {
  // Ejemplo con TradingEconomics API
  const response = await fetch(
    `https://api.tradingeconomics.com/calendar/${event.id}?c=${API_KEY}`
  )
  const data = await response.json()
  
  if (!data.Actual) {
    return null // Aún no publicado
  }
  
  return {
    actual: data.Actual,
    previous: data.Previous ?? event.previous_value,
    consensus: data.Forecast ?? event.consensus_value,
    time: data.Date ?? new Date().toISOString(),
  }
}
```

### 3. `/api/jobs/compute/bias` (ya existente)

**Objetivo:** Recalcular sesgos macro y correlaciones

**Se llama automáticamente** desde `/api/jobs/ingest/releases` cuando hay releases nuevos.

También puedes llamarlo manualmente:
```bash
curl -X POST https://tuapp.vercel.app/api/jobs/compute/bias \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

## 🔐 Seguridad

Todos los jobs están protegidos con `CRON_TOKEN`. Configura la variable de entorno:

```bash
# En Vercel: Settings → Environment Variables
CRON_TOKEN=tu_token_secreto_aqui

# En GitHub Actions: Settings → Secrets
CRON_TOKEN=tu_token_secreto_aqui
```

## 📅 Configuración en Vercel Cron

Crea `vercel.json` con los cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/jobs/ingest/calendar",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/jobs/ingest/releases",
      "schedule": "* 8-20 * * *"
    }
  ]
}
```

## 🔄 Flujo Completo de un Release

1. **02:00 UTC (cada día):** Job `ingest/calendar` actualiza eventos de la semana
2. **Cada minuto (08:00-20:00 UTC):** Job `ingest/releases` verifica si hay eventos próximos
3. **Cuando sale un dato:**
   - Detecta el evento en ventana `[now - 2m, now + 1m]`
   - Obtiene dato real de la API
   - Calcula sorpresa (`surprise_raw`, `surprise_pct`, `surprise_score`, `surprise_direction`)
   - Crea `economic_release`
   - Registra impacto (`macro_event_impact`) con scores before/after
   - Recomputa bias y correlaciones
4. **Dashboard se actualiza:** `/api/bias` ahora incluye `recentEvents` y filas tácticas enriquecidas

## 🎯 Mapeo de Eventos

El sistema mapea automáticamente eventos comunes a series FRED e indicator_keys:

**USD:**
- CPI YoY → `CPIAUCSL` / `us_cpi_yoy`
- Core CPI → `CPILFESL` / `us_corecpi_yoy`
- NFP → `PAYEMS` / `us_nfp_change`
- Unemployment Rate → `UNRATE` / `us_unrate`
- GDP → `GDPC1` / `us_gdp_yoy`
- Fed Rate → `FEDFUNDS` / `us_fedfunds`

**EUR:**
- CPI YoY → `EU_CPI_YOY` / `eu_cpi_yoy`
- GDP → `EU_GDP_YOY` / `eu_gdp_yoy`
- ECB Rate → `EU_ECB_RATE` / `eu_ecb_rate`

**GBP:**
- CPI YoY → `UK_CPI_YOY` / `uk_cpi_yoy`
- BoE Rate → `UK_BOE_RATE` / `uk_boe_rate`

**JPY:**
- CPI YoY → `JP_CPI_YOY` / `jp_cpi_yoy`
- BoJ Rate → `JP_BOJ_RATE` / `jp_boj_rate`

Puedes expandir `mapExternalEventToInternal()` en `/api/jobs/ingest/calendar/route.ts` para añadir más mapeos.

## 🧪 Testing

### Probar job de calendario:
```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### Probar job de releases:
```bash
curl -X POST http://localhost:3000/api/jobs/ingest/releases \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### Insertar evento de prueba manualmente:
```bash
pnpm tsx scripts/example-insert-economic-event.ts
```

## 📊 Monitoreo

Los jobs logean información útil:
- Número de eventos procesados
- Errores (si los hay)
- Releases creados
- Impacto registrado

Revisa logs en:
- **Vercel:** Dashboard → Logs
- **Local:** Console output

## 🚀 Próximos Pasos

1. **Implementar `fetchFromCalendarAPI()`** según tu API de calendario preferida
2. **Implementar `fetchReleaseFromCalendarAPI()`** para obtener datos reales
3. **Configurar cron jobs** en Vercel o GitHub Actions
4. **Probar con datos reales** durante horas de mercado
5. **Ajustar ventanas y frecuencias** según tus necesidades

