# Configuración de Proveedores de Calendario Económico

## 📋 Resumen

Este documento explica cómo configurar y usar proveedores de calendario económico con la capa de abstracción implementada.

## 🏗️ Arquitectura

### Capa de Abstracción

La implementación usa una capa de abstracción que permite cambiar de proveedor sin modificar la lógica de negocio:

```
lib/calendar/
├── types.ts                    # Tipos genéricos (ProviderCalendarEvent, ProviderRelease)
├── provider.ts                 # Interfaz CalendarProvider
├── tradingEconomicsProvider.ts # Implementación para TradingEconomics
├── mappers.ts                  # Mapeo de eventos a configuración interna
└── fetchReleaseFromCalendarAPI.ts # Helper para obtener releases
```

### Flujo de Datos

```
Proveedor Externo (TradingEconomics, etc.)
    ↓
CalendarProvider.fetchCalendar() / fetchRelease()
    ↓
ProviderCalendarEvent / ProviderRelease (tipos genéricos)
    ↓
mapProviderEventToInternal() → InternalMapping
    ↓
upsertEconomicEvent() / upsertEconomicRelease()
    ↓
SQLite: economic_events / economic_releases
```

## 🔧 Configuración

### 1. Variables de Entorno

```bash
# En Vercel: Settings → Environment Variables
TRADING_ECONOMICS_API_KEY=tu_api_key_aqui
CRON_TOKEN=tu_token_secreto
APP_URL=https://tuapp.vercel.app
```

### 2. Obtener API Key de TradingEconomics

1. Regístrate en: https://tradingeconomics.com/api
2. Obtén tu API key
3. Configúrala en variables de entorno

**Nota:** TradingEconomics tiene plan gratuito limitado. Para producción, considera planes de pago.

## 🔌 Implementar Nuevo Proveedor

Para añadir un nuevo proveedor (ej: Investing.com, FXStreet), solo necesitas:

### Paso 1: Crear Implementación

```typescript
// lib/calendar/investingProvider.ts
import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

export class InvestingProvider implements CalendarProvider {
  constructor(private apiKey: string) {}

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    // Implementar llamada HTTP a Investing.com API
    // Mapear respuesta a ProviderCalendarEvent[]
    return []
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // Implementar llamada HTTP a Investing.com API
    // Mapear respuesta a ProviderRelease
    return null
  }
}
```

### Paso 2: Actualizar Helper

```typescript
// lib/calendar/fetchReleaseFromCalendarAPI.ts
import { InvestingProvider } from './investingProvider'

function getProvider(): CalendarProvider {
  const providerType = process.env.CALENDAR_PROVIDER || 'tradingeconomics'
  
  if (providerType === 'investing') {
    return new InvestingProvider(process.env.INVESTING_API_KEY!)
  }
  
  return new TradingEconomicsProvider(process.env.TRADING_ECONOMICS_API_KEY!)
}
```

### Paso 3: Configurar Variable de Entorno

```bash
CALENDAR_PROVIDER=investing  # o 'tradingeconomics'
INVESTING_API_KEY=tu_key_aqui
```

## 📝 Mapeo de Eventos

El sistema mapea automáticamente eventos comunes a series FRED e indicator_keys.

### Mapeos Implementados

**USD:**
- CPI YoY → `CPIAUCSL` / `us_cpi_yoy`
- Core CPI → `CPILFESL` / `us_corecpi_yoy`
- Core PCE → `PCEPILFE` / `us_corepce_yoy`
- Nonfarm Payrolls → `PAYEMS` / `us_nfp_change`
- Unemployment Rate → `UNRATE` / `us_unrate` (lower_is_positive)
- GDP → `GDPC1` / `us_gdp_yoy`
- Retail Sales → `RSXFS` / `us_retail_yoy`
- PMI/ISM → `USPMI` / `us_pmi_mfg`
- Fed Rate → `FEDFUNDS` / `us_fedfunds`

**EUR:**
- CPI YoY → `EU_CPI_YOY` / `eu_cpi_yoy`
- Core CPI → `EU_CPI_CORE_YOY` / `eu_cpi_core_yoy`
- GDP → `EU_GDP_YOY` / `eu_gdp_yoy`
- ECB Rate → `EU_ECB_RATE` / `eu_ecb_rate`
- PMI → `EU_PMI_MANUFACTURING` / `eu_pmi_manufacturing`
- Unemployment → `EU_UNEMPLOYMENT` / `eu_unemployment` (lower_is_positive)

**GBP:**
- CPI YoY → `UK_CPI_YOY` / `uk_cpi_yoy`
- Core CPI → `UK_CORE_CPI_YOY` / `uk_core_cpi_yoy`
- BoE Rate → `UK_BOE_RATE` / `uk_boe_rate`
- GDP → `UK_GDP_YOY` / `uk_gdp_yoy`

**JPY:**
- CPI YoY → `JP_CPI_YOY` / `jp_cpi_yoy`
- Core CPI → `JP_CORE_CPI_YOY` / `jp_core_cpi_yoy`
- BoJ Rate → `JP_BOJ_RATE` / `jp_boj_rate`
- GDP → `JP_GDP_YOY` / `jp_gdp_yoy`

### Añadir Nuevos Mapeos

Puedes añadir mapeos de dos formas:

#### Opción 1: Hardcoded en `lib/calendar/mappers.ts`

Añade casos en `mapProviderEventToInternal()`:

```typescript
if (currency === 'USD' && nameLower.includes('new event')) {
  return {
    // ... mapping
  }
}
```

#### Opción 2: Config JSON (recomendado)

Crea `config/event-mapping.json`:

```json
{
  "mappings": {
    "USD_cpiyoy": {
      "seriesId": "CPIAUCSL",
      "indicatorKey": "us_cpi_yoy",
      "directionality": "higher_is_positive",
      "category": "Inflation"
    },
    "EUR_gdpyoy": {
      "seriesId": "EU_GDP_YOY",
      "indicatorKey": "eu_gdp_yoy",
      "directionality": "higher_is_positive",
      "category": "Growth"
    }
  }
}
```

El mapper carga automáticamente este archivo.

## 🧪 Testing

### Probar Provider Directamente

```typescript
import { TradingEconomicsProvider } from '@/lib/calendar/tradingEconomicsProvider'

const provider = new TradingEconomicsProvider(process.env.TRADING_ECONOMICS_API_KEY!)

const events = await provider.fetchCalendar({
  from: new Date('2025-12-01'),
  to: new Date('2025-12-31'),
  minImportance: 'high',
})

console.log('Events:', events)
```

### Probar Job de Calendario

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### Probar Job de Releases

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/releases \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

## 📅 Cron Jobs

### Vercel Cron

Crea o actualiza `vercel.json`:

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

**Horarios:**
- `calendar`: Cada día a las 02:00 UTC (actualiza semana completa)
- `releases`: Cada minuto de 08:00 a 20:00 UTC (solo durante horas de mercado)

### GitHub Actions (Alternativa)

Crea `.github/workflows/calendar-ingest.yml`:

```yaml
name: Calendar Ingest
on:
  schedule:
    - cron: '0 2 * * *'  # Cada día a las 02:00 UTC
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Call Calendar Ingest
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/jobs/ingest/calendar \
            -H "Authorization: Bearer ${{ secrets.CRON_TOKEN }}"
```

Crea `.github/workflows/releases-ingest.yml`:

```yaml
name: Releases Ingest
on:
  schedule:
    - cron: '* 8-20 * * *'  # Cada minuto de 08:00 a 20:00 UTC
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Call Releases Ingest
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/jobs/ingest/releases \
            -H "Authorization: Bearer ${{ secrets.CRON_TOKEN }}"
```

**Secrets necesarios en GitHub:**
- `APP_URL`: URL de tu app (ej: `https://tuapp.vercel.app`)
- `CRON_TOKEN`: Token secreto para autenticación

## 🔍 Troubleshooting

### Error: "TRADING_ECONOMICS_API_KEY is required"

**Solución:** Configura la variable de entorno `TRADING_ECONOMICS_API_KEY` en Vercel o localmente.

### Error: "Unauthorized" al llamar jobs

**Solución:** Verifica que `CRON_TOKEN` esté configurado y que lo uses en el header `Authorization: Bearer ${CRON_TOKEN}`.

### No se están creando releases

**Posibles causas:**
1. El evento aún no ha sido publicado (normal, el job retorna null)
2. El `source_event_id` no coincide con el `externalId` del proveedor
3. La ventana de tiempo no incluye el evento (verifica `[now - 2m, now + 1m]`)

### Mapeos no funcionan

**Solución:** Verifica que el nombre del evento en el proveedor coincida con los patrones en `mapProviderEventToInternal()`. Puedes añadir logs para debug:

```typescript
console.log('[mapper] Event:', ev.name, ev.currency)
const mapping = mapProviderEventToInternal(ev)
console.log('[mapper] Mapping:', mapping)
```

## 📚 Referencias

- `docs/CALENDARIO-Y-SORPRESAS-MACRO.md` - Documentación técnica completa
- `docs/CONFIGURACION-JOBS-CALENDARIO.md` - Configuración de jobs
- `lib/calendar/tradingEconomicsProvider.ts` - Ejemplo de implementación

## 🚀 Próximos Pasos

1. **Obtener API key** de TradingEconomics (o tu proveedor preferido)
2. **Configurar variables de entorno** en Vercel
3. **Probar job de calendario** manualmente
4. **Configurar cron jobs** en Vercel o GitHub Actions
5. **Monitorear logs** para verificar que funciona correctamente
6. **Ajustar mapeos** según eventos específicos que necesites

