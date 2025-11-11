# Macro Data Sources

Documentación de las fuentes de datos macroeconómicos integradas en el dashboard.

## Política de Fuentes de Datos

**Este proyecto solo integra fuentes gratuitas y públicas, sin API keys ni licencias propietarias.**

Si un indicador no está disponible en fuentes abiertas:
- (a) Debe devolver `NOT_AVAILABLE_FREE_SOURCE` con un mensaje claro
- (b) Debe ofrecer un proxy gratuito documentado cuando sea posible

**Ejemplo**: PMI (Purchasing Managers' Index) es propiedad de S&P Global y no está disponible gratuitamente. En su lugar, ofrecemos `INDUSTRIAL_PRODUCTION_INDEX` (IPI) como proxy, que está disponible en IMF/ECB y suele correlacionar con el ciclo manufacturero.

## Contrato MacroSeries

Todas las fuentes de datos devuelven un objeto `MacroSeries` con la siguiente estructura:

```typescript
interface MacroSeries {
  id: string                    // SOURCE:nativeId[:country]
  source: Source                // 'FRED' | 'WORLD_BANK' | 'IMF' | 'ECB_SDW'
  indicator: string             // Código del indicador
  nativeId: string              // ID nativo de la fuente
  name: string                  // Nombre descriptivo
  frequency: Frequency          // 'A' | 'Q' | 'M' | 'W' | 'D'
  unit?: string                 // Unidad de medida (opcional)
  country?: string              // Código ISO3 del país (opcional)
  data: DataPoint[]             // Array de puntos de datos ordenados ASC
  lastUpdated?: string          // Fecha del último dato (YYYY-MM-DD)
  meta?: Record<string, unknown> // Metadatos adicionales
}

interface DataPoint {
  date: string                  // Fecha normalizada (YYYY-MM-DD)
  value: number | null          // Valor numérico o null
}
```

### Frecuencias y Normalización de Fechas

Las fechas se normalizan según la frecuencia:

- **A (Anual)**: `YYYY-12-31`
- **Q (Trimestral)**: Primer día del trimestre (`YYYY-01-01`, `YYYY-04-01`, `YYYY-07-01`, `YYYY-10-01`)
- **M (Mensual)**: `YYYY-MM-01`
- **W (Semanal)**: `YYYY-MM-DD` (conserva el día)
- **D (Diario)**: `YYYY-MM-DD` (conserva el día)

Los datos siempre están ordenados en orden ascendente por fecha.

## Endpoints API

### World Bank

**GET** `/api/macro/worldbank`

Obtiene datos del Banco Mundial.

**Query Parameters:**
- `country` (opcional, default: `USA`): Código ISO3 del país (ej: `USA`, `GBR`, `DEU`)
- `indicator` (opcional, default: `FP.CPI.TOTL.ZG`): Código del indicador

**Ejemplo:**
```bash
curl "http://localhost:3000/api/macro/worldbank?country=USA&indicator=FP.CPI.TOTL.ZG"
```

**Respuesta:**
```json
{
  "id": "WORLD_BANK:FP.CPI.TOTL.ZG:USA",
  "source": "WORLD_BANK",
  "indicator": "FP.CPI.TOTL.ZG",
  "nativeId": "USA:FP.CPI.TOTL.ZG",
  "name": "Inflation, consumer prices (annual %)",
  "frequency": "A",
  "country": "USA",
  "data": [
    { "date": "2020-12-31", "value": 1.2 },
    { "date": "2021-12-31", "value": 4.7 },
    { "date": "2022-12-31", "value": 8.0 },
    { "date": "2023-12-31", "value": 3.2 }
  ],
  "lastUpdated": "2023-12-31"
}
```

### IMF

**GET** `/api/macro/imf`

Obtiene datos del Fondo Monetario Internacional (SDMX).

**Query Parameters:**
- `flow` (opcional, default: `IFS`): Flujo de datos
- `key` (opcional, default: `PCPIPCH.USA.A`): Clave de la serie
- `freq` (opcional, default: `A`): Frecuencia (`A`, `Q`, `M`, `W`, `D`)

**Ejemplo:**
```bash
curl "http://localhost:3000/api/macro/imf?flow=IFS&key=PCPIPCH.USA.A&freq=A"
```

**Respuesta:**
```json
{
  "id": "IMF:IFS:PCPIPCH.USA.A",
  "source": "IMF",
  "indicator": "PCPIPCH.USA.A",
  "nativeId": "IFS:PCPIPCH.USA.A",
  "name": "Consumer Price Index, All items, Percent change, Annual",
  "frequency": "A",
  "data": [
    { "date": "2020-12-31", "value": 1.2 },
    { "date": "2021-12-31", "value": 4.7 },
    { "date": "2022-12-31", "value": 8.0 },
    { "date": "2023-12-31", "value": 3.2 }
  ],
  "lastUpdated": "2023-12-31"
}
```

### ECB

**GET** `/api/macro/ecb`

Obtiene datos del Banco Central Europeo (Statistical Data Warehouse).

**Query Parameters:**
- `flow` (opcional, default: `EXR`): Flujo de datos
- `key` (opcional, default: `D.USD.EUR.SP00.A`): Clave de la serie
- `freq` (opcional, default: `D`): Frecuencia (`A`, `Q`, `M`, `W`, `D`)

**Ejemplo:**
```bash
curl "http://localhost:3000/api/macro/ecb?flow=EXR&key=D.USD.EUR.SP00.A&freq=D"
```

**Respuesta:**
```json
{
  "id": "ECB_SDW:EXR:D.USD.EUR.SP00.A",
  "source": "ECB_SDW",
  "indicator": "D.USD.EUR.SP00.A",
  "nativeId": "EXR:D.USD.EUR.SP00.A",
  "name": "ECB Exchange Rates",
  "frequency": "D",
  "data": [
    { "date": "2024-01-12", "value": 1.0935 },
    { "date": "2024-01-13", "value": 1.0940 },
    { "date": "2024-01-14", "value": 1.0945 },
    { "date": "2024-01-15", "value": 1.0950 }
  ],
  "lastUpdated": "2024-01-15"
}
```

## Catálogo Canónico

El catálogo (`lib/catalog/index.ts`) mapea indicadores canónicos a parámetros específicos de cada fuente.

### Indicadores Soportados

#### CPI_YOY (Inflación, variación anual)

- **WORLD_BANK**: `FP.CPI.TOTL.ZG`
- **IMF**: `PCPIPCH.{ISO3}.A` (flujo `IFS`)
- **ECB_SDW**: `M.I10.CP0000.IX2015.A` (flujo `ICP`)

#### GDP_REAL (PIB Real)

- **WORLD_BANK**: `NY.GDP.MKTP.KD`
- **IMF**: `NGDP_R_{ISO3}.A` (flujo `IFS`)

### Cómo Añadir Más Indicadores

1. Edita `lib/catalog/index.ts`
2. Añade una nueva entrada en `MacroCatalog`:

```typescript
export const MacroCatalog: Record<CatalogIndicator, CatalogEntry> = {
  // ... existentes
  NEW_INDICATOR: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'INDICATOR.CODE',
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `KEY.${iso3}.A`,
      freq: 'A',
    }),
  },
}
```

## Política de Cache

- **Revalidación**: 6 horas por defecto (configurable via `MACRO_DEFAULT_REVALIDATE_HOURS`)
- **Timeout**: 8 segundos por defecto (configurable via `MACRO_FETCH_TIMEOUT_MS`)
- **Cache-Control**: Headers HTTP configurados en respuestas
- **Frontend**: Cache en memoria del hook `useMacroSeries` (5 minutos)

## Límites y Rate Limiting

- **Rate Limit**: 60 solicitudes por minuto por IP
- **Reintentos**: 2 intentos con backoff exponencial (300ms, 900ms)
- **Timeout**: 8 segundos por solicitud

Si se excede el límite, se devuelve un error 429.

## Manejo de Errores

### Errores de Validación (400)

- Código de país inválido (debe ser ISO3: `[A-Z]{3}`)
- Código de indicador inválido
- Frecuencia inválida

### Errores de Servicio Externo (503)

- Error al conectar con la API externa
- Timeout de la solicitud
- Respuesta inválida de la API

### NO_DATA

Si una serie no tiene datos disponibles, se devuelve un `MacroSeries` con:
- `data: []`
- `meta.reason: 'NO_DATA'`

Esto no es un error, sino una respuesta válida con datos vacíos.

## Errores Comunes y Soluciones

### Error: "Invalid country code"

**Causa**: El código de país no es ISO3 válido.

**Solución**: Usa códigos de 3 letras mayúsculas (ej: `USA`, `GBR`, `DEU`).

### Error: "Rate limit exceeded"

**Causa**: Demasiadas solicitudes en un minuto.

**Solución**: Espera 1 minuto o implementa cache en el cliente.

### Error: "External service error"

**Causa**: La API externa no está disponible o devolvió un error.

**Solución**: 
- Verifica que la API externa esté operativa
- Revisa los logs del servidor para más detalles
- Intenta nuevamente (el sistema hace reintentos automáticos)

### Datos vacíos (NO_DATA)

**Causa**: La serie solicitada no existe o no tiene datos para el período.

**Solución**: 
- Verifica que el código del indicador sea correcto
- Consulta la documentación de la API externa
- Prueba con otro indicador o país

## Logs Estructurados

Los endpoints registran logs en formato JSON:

```json
{
  "source": "WORLD_BANK",
  "url": "/api/macro/worldbank?country=USA",
  "durationMs": 1234,
  "points": 64,
  "status": "success"
}
```

Para errores:

```json
{
  "source": "IMF",
  "url": "/api/macro/imf?flow=IFS&key=INVALID",
  "durationMs": 5000,
  "status": "error",
  "error": "IMF 404: Not Found"
}
```

## Uso en Frontend

### Hook useMacroSeries

```typescript
import { useMacroSeries } from '@/lib/hooks/useMacroSeries'

function MyComponent() {
  const { data, isLoading, error } = useMacroSeries('WORLD_BANK', {
    country: 'USA',
    indicator: 'FP.CPI.TOTL.ZG',
  })

  if (isLoading) return <div>Cargando...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return null

  return (
    <div>
      <h2>{data.name}</h2>
      <p>Puntos: {data.data.length}</p>
    </div>
  )
}
```

### Página Demo

Visita `/macro-demo` para ver ejemplos de uso con las tres fuentes de datos.

## Indicadores Canónicos Disponibles

### Indicadores Básicos

| Indicador | World Bank | IMF | ECB | Notas |
|-----------|------------|-----|-----|-------|
| `CPI_YOY` | ✅ | ✅ | ✅ | Inflación anual |
| `GDP_REAL` | ✅ | ✅ | ❌ | PIB real |
| `UNEMP_RATE` | ✅ | ✅ | ✅ | Tasa de desempleo |
| `RETAIL_SALES` | ❌ | ✅ | ✅ | Ventas minoristas (índice) |
| `CURRENT_ACCOUNT` | ✅ | ✅ | ✅ | Cuenta corriente (USD) |
| `CURRENT_ACCOUNT_PCT_GDP` | ✅ | ⚠️ | ❌ | Cuenta corriente (% PIB) - requiere derivación en IMF |
| `EXPORTS_GS_USD` | ✅ | ✅ | ✅ | Exportaciones bienes+servicios |
| `IMPORTS_GS_USD` | ✅ | ✅ | ✅ | Importaciones bienes+servicios |
| `TRADE_BALANCE_USD` | ⚠️ | ✅ | ✅ | Balanza comercial - derivado en WB |
| `INDUSTRIAL_PRODUCTION_INDEX` | ❌ | ✅ | ✅ | Índice de producción industrial (proxy para PMI) |
| `PMI_MANUF` | ❌ | ❌ | ❌ | **No disponible** - usar `INDUSTRIAL_PRODUCTION_INDEX` como proxy |

**Leyenda:**
- ✅ Disponible directamente
- ⚠️ Requiere derivación (calculado desde otras series)
- ❌ No disponible en esta fuente

### Indicadores Derivados

Algunos indicadores se calculan a partir de otros:

- **TRADE_BALANCE_USD** = EXPORTS_GS_USD - IMPORTS_GS_USD
- **CURRENT_ACCOUNT_PCT_GDP** = (CURRENT_ACCOUNT_USD / GDP_CURRENT_USD) × 100

## Endpoint de Indicadores Derivados

**GET** `/api/macro/derived`

Obtiene indicadores calculados a partir de series base.

**Query Parameters:**
- `name` (requerido): Nombre del indicador canónico (ej: `TRADE_BALANCE_USD`, `CURRENT_ACCOUNT_PCT_GDP`)
- `source` (requerido): Fuente de datos (`WORLD_BANK`, `IMF`, `ECB_SDW`)
- `country` (requerido): Código ISO3 del país

**Ejemplo:**
```bash
curl "http://localhost:3000/api/macro/derived?name=TRADE_BALANCE_USD&source=WORLD_BANK&country=USA"
```

**Respuesta:**
```json
{
  "id": "DERIVED:EXPORTS_GS_USD_IMPORTS_GS_USD",
  "source": "WORLD_BANK",
  "indicator": "Trade Balance (Goods and Services)",
  "nativeId": "DERIVED:SUB",
  "name": "Trade Balance (Goods and Services)",
  "frequency": "A",
  "unit": "USD",
  "country": "USA",
  "data": [
    { "date": "2022-12-31", "value": -750000000000 },
    { "date": "2023-12-31", "value": -800000000000 }
  ],
  "lastUpdated": "2023-12-31",
  "meta": {
    "derivation": {
      "formula": "SUB",
      "sources": [
        { "source": "WORLD_BANK", "indicator": "EXPORTS_GS_USD" },
        { "source": "WORLD_BANK", "indicator": "IMPORTS_GS_USD" }
      ]
    },
    "baseSeries": ["WORLD_BANK:NE.EXP.GNFS.CD:USA", "WORLD_BANK:NE.IMP.GNFS.CD:USA"]
  }
}
```

## Códigos WDI (World Bank) Utilizados

- `SL.UEM.TOTL.ZS` - Tasa de desempleo (% población activa)
- `BN.CAB.XOKA.CD` - Cuenta corriente (USD corrientes)
- `BN.CAB.XOKA.GD.ZS` - Cuenta corriente (% PIB)
- `NE.EXP.GNFS.CD` - Exportaciones bienes+servicios (USD)
- `NE.IMP.GNFS.CD` - Importaciones bienes+servicios (USD)

## Nota Legal: PMI

**PMI (Purchasing Managers' Index)** es propiedad de **S&P Global** y no está disponible en fuentes gratuitas. 

Este proyecto ofrece **INDUSTRIAL_PRODUCTION_INDEX (IPI)** como proxy, que:
- Está disponible gratuitamente en IMF/ECB
- Suele correlacionar con el ciclo manufacturero
- Proporciona una alternativa válida para análisis macro

## Próximos Pasos (Roadmap)

- [ ] Añadir OECD SDMX
- [ ] Añadir BIS (Bank for International Settlements)
- [ ] Persistencia opcional en base de datos
- [ ] Cron de refresco automático
- [ ] Mejorar resolución dinámica SDMX con queries reales a dataflow APIs
