# 🔌 Adaptadores de Ingesta - Notificaciones Telegram

## Descripción

Los adaptadores de ingesta convierten payloads de proveedores externos al formato estándar `NewsItem` requerido por `/api/news/insert`.

**Ubicación:** `lib/providers/ingest_adapter.ts`

## Uso Básico

```typescript
import { adaptFromProvider } from '@/lib/providers/ingest_adapter'
import { insertNewsItem } from '@/lib/notifications/news'

// Adaptar payload del proveedor
const newsItem = adaptFromProvider('BLS', providerPayload)

if (newsItem) {
  // Insertar y notificar
  await insertNewsItem(newsItem)
}
```

## Proveedores Soportados

### BLS (Bureau of Labor Statistics)

**Configuración:**
- `name: 'BLS'`
- Impacto `high`: CPI, NFP, Employment
- Títulos canónicos: `CPI m/m`, `Nonfarm Payrolls`, `PPI m/m`

**Ejemplo de Payload:**
```json
{
  "id": "bls_2025-11_cpi",
  "source": "BLS",
  "title": "Consumer Price Index",
  "country": "US",
  "theme": "Inflación",
  "impact": "high",
  "published_at": "2025-11-10T13:30:00Z",
  "value": 0.5,
  "expected": 0.3,
  "summary": "CPI above consensus"
}
```

**Mapeo:**
- `id` → `id_fuente` (prefijo: `bls_`)
- `title` → `titulo` (mapeo canónico)
- `impact` → `impacto` (high/med/low)
- `value` → `valor_publicado`
- `expected` → `valor_esperado`

### S&P Global

**Configuración:**
- `name: 'S&P Global'`
- Impacto `high`: PMI flash, final
- Títulos canónicos: `PMI Manufacturas`, `PMI Servicios`

**Ejemplo de Payload:**
```json
{
  "event_id": "spglobal_pmi_2025-11",
  "provider": "S&P Global",
  "event": "Manufacturing PMI",
  "country_code": "US",
  "category": "Crecimiento",
  "importance": "high",
  "release_date": "2025-11-10T14:45:00Z",
  "actual": 49.0,
  "forecast": 50.0
}
```

**Mapeo:**
- `event_id` → `id_fuente` (prefijo: `s&p_global_`)
- `event` → `titulo` (mapeo canónico)
- `importance` → `impacto`
- `actual` → `valor_publicado`
- `forecast` → `valor_esperado`

### TradingEconomics

**Configuración:**
- `name: 'TradingEconomics'`
- Impacto numérico: `3` = high, `2` = med, `1` = low

**Ejemplo de Payload:**
```json
{
  "release_id": "te_us_cpi_2025-11",
  "source": "TradingEconomics",
  "indicator": "CPI m/m",
  "country": "United States",
  "theme": "Inflación",
  "priority": 3,
  "timestamp": "2025-11-10T13:30:00Z",
  "actual": 0.5,
  "consensus": 0.3
}
```

## Crear Nuevo Adaptador

### 1. Definir Configuración

```typescript
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  'Tu Proveedor': {
    name: 'Tu Proveedor',
    impactMapping: {
      high: ['high', 'critical', 'major'],
      med: ['med', 'medium'],
      low: ['low', 'minor'],
    },
    titleMapping: {
      'Provider Title': 'Título Canónico',
    },
    countryMapping: {
      'US': 'US',
      'USA': 'US',
    },
  },
}
```

### 2. Mapear Campos

El adaptador busca estos campos en el payload:

- `id` / `event_id` / `release_id` → `id_fuente`
- `source` / `provider` → `fuente`
- `title` / `event` / `indicator` → `titulo`
- `country` / `country_code` / `pais` → `pais`
- `theme` / `category` / `tema` → `tema`
- `impact` / `importance` / `priority` → `impacto`
- `published_at` / `release_date` / `timestamp` → `published_at`
- `value` / `actual` / `valor_publicado` → `valor_publicado`
- `expected` / `forecast` / `consensus` / `valor_esperado` → `valor_esperado`
- `summary` / `description` / `resumen` → `resumen`

### 3. Normalización Automática

El adaptador normaliza automáticamente:

- **Impacto:** Mapea a `high`/`med`/`low` según configuración
- **Fecha:** Convierte a UTC ISO string
- **Título:** Genera título canónico si no existe mapeo
- **ID:** Genera `id_fuente` estable: `{provider}_{id}`

## Retry y Backoff

```typescript
import { retryProviderRequest } from '@/lib/providers/ingest_adapter'

// Reintento automático con backoff exponencial
const result = await retryProviderRequest(
  async () => {
    const response = await fetch(providerUrl)
    if (!response.ok) throw new Error('Failed')
    return response.json()
  },
  3,      // maxRetries
  2000    // baseDelayMs (2s, 4s, 8s)
)
```

**Recomendación:** No reintentar más de 3 veces. Backoff: 2-5 segundos.

## Validación

El adaptador valida:

- ✅ `id_fuente` requerido
- ✅ `titulo` requerido
- ✅ `published_at` requerido
- ✅ `impacto` normalizado (high/med/low)
- ✅ `published_at` en formato UTC ISO

Si falta algún campo requerido, retorna `null` y registra warning.

## Ejemplos de Integración

### Webhook Handler

```typescript
// app/api/webhooks/bls/route.ts
import { adaptFromProvider } from '@/lib/providers/ingest_adapter'
import { insertNewsItem } from '@/lib/notifications/news'

export async function POST(request: Request) {
  const payload = await request.json()
  const newsItem = adaptFromProvider('BLS', payload)
  
  if (newsItem) {
    await insertNewsItem(newsItem)
    return Response.json({ success: true })
  }
  
  return Response.json({ error: 'Invalid payload' }, { status: 400 })
}
```

### Script de Ingesta

```typescript
// scripts/ingest-bls.ts
import { adaptFromProvider } from '@/lib/providers/ingest_adapter'
import { insertNewsItem } from '@/lib/notifications/news'

const blsData = await fetchBLSData()
for (const item of blsData) {
  const newsItem = adaptFromProvider('BLS', item)
  if (newsItem) {
    await insertNewsItem(newsItem)
  }
}
```

## Troubleshooting

**Problema:** `adaptFromProvider` retorna `null`

- Verificar que el proveedor existe en `PROVIDER_CONFIGS`
- Revisar logs: `[ingest_adapter] Missing required fields`
- Asegurar que `id`, `title`, `published_at` están presentes

**Problema:** Títulos no se mapean correctamente

- Añadir mapeo en `titleMapping` de la configuración
- O verificar que el título sigue el patrón esperado

**Problema:** Impacto siempre `med`

- Verificar `impactMapping` en configuración
- Asegurar que el campo de impacto del proveedor coincide con los valores esperados

---

*Última actualización: Enero 2025*




