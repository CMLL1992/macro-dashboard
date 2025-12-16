# European Indicators: Design Decisions

## Overview

This document describes architectural decisions and standards for European (Eurozone) economic indicators ingestion and processing.

## Data Source Standards

### Eurostat: Seasonally Adjusted Data (`s_adj`)

**Standard: Use `SCA` (Seasonally and Calendar Adjusted) for all Eurostat monthly/quarterly indicators.**

#### Why SCA?

Eurostat provides three adjustment options for time series:
- `CA`: Calendar Adjusted only
- `NSA`: Not Seasonally Adjusted (raw data)
- `SCA`: Seasonally and Calendar Adjusted ✅ **Standard**

#### Rationale

1. **Consistency**: SCA provides the most comparable data across indicators
2. **Availability**: Most Eurostat datasets (e.g., `sts_trtu_m`, `sts_inpr_m`) only offer `SCA` for monthly series, not `SA`
3. **Quality**: SCA removes both seasonal patterns and calendar effects (holidays, working days), providing cleaner trend analysis

#### Implementation

All Eurostat indicators in `config/european-indicators.json` use:
```json
{
  "filters": {
    "s_adj": "SCA"
  }
}
```

**Exception**: Quarterly GDP (`namq_10_gdp`) may use different units/transformations, but still uses `SCA` for seasonal adjustment.

### Geographic Area: EA20

**Standard: Use `EA20` (Euro Area 20) as primary geographic filter.**

#### Fallback Strategy

The ingestion pipeline automatically falls back to:
1. `EA20` (primary)
2. `EA19` (fallback if EA20 fails)
3. `EU27_2020` (final fallback)

This is implemented in `lib/datasources/eurostat.ts`:
```typescript
// Automatic fallback on 400 errors
if (error instanceof Error && error.message.includes('400')) {
  const fallbackGeos = geo === 'EA20' ? ['EA19', 'EU27_2020'] : ...
}
```

### Frequency Parameter

**Standard: Always include `freq` explicitly in filters.**

Eurostat requires the frequency dimension to be specified. The ingestion code automatically adds `freq` to filters if not present:

```typescript
if (!filters.freq && frequency) {
  filterParams.set('freq', frequency)
}
```

## Data Quality Monitoring

### Zero Observations Alert

The ingestion job (`app/api/jobs/ingest/european/route.ts`) logs a warning if any indicator returns 0 observations:

```typescript
if (!macroSeries || macroSeries.data.length === 0) {
  logger.warn(`No observations for ${indicator.id} from ${indicator.source}`, { job: jobId })
  errors++
  ingestErrors.push({ indicatorId: indicator.id, error: 'No data returned from source' })
  continue
}
```

This ensures that data quality issues are immediately visible in logs and job responses.

### Coverage Metrics

Coverage is calculated as the percentage of indicators with data (non-null values) per region:
- **EU**: 14 indicators defined in `config/european-indicators.json`
- **US**: Indicators from `config/macro-indicators.ts` and `config/currency-indicators.json`

Coverage metrics are available via:
- Dashboard API: `/api/dashboard` (includes `coverage` field)
- Health endpoint: `/api/health` (includes regional coverage)

## Error Handling

### Fetch Failures

Individual indicator fetch failures do not abort the entire job. Each indicator is processed independently:

```typescript
try {
  macroSeries = await fetchEurostatSeries(eurostatParams)
} catch (fetchError) {
  logger.error(`Failed to fetch ${indicator.id}`, { error: fetchError })
  errors++
  ingestErrors.push({ indicatorId: indicator.id, error: ... })
  continue // Skip to next indicator
}
```

### Schema Migrations

The job ensures database schema is up-to-date before ingestion:

```typescript
const { initializeSchemaUnified } = await import('@/lib/db/unified-db')
await initializeSchemaUnified()
```

This handles cases where new columns (e.g., `observation_period`) are added to the schema.

## Logging Standards

### Detailed Logging

All Eurostat fetches log:
- Full URL
- Parameters (dataset, filters, geo, frequency)
- Response details (status, size, dimension keys, value count)
- Success/failure with data point counts

Example:
```typescript
console.log(`[Eurostat] Response for ${dataset}:`, {
  url,
  status: response.status,
  responseSize,
  dimensionKeys,
  nValues,
  hasTimeDim,
})
```

## Future Considerations

### Provider Changes

If Eurostat changes API structure or dimension codes:
1. Check logs for dimension keys returned
2. Use `/api/debug/eurostat-test` endpoint to test queries
3. Update `config/european-indicators.json` filters accordingly
4. Document changes in this file

### Alternative Sources

If Eurostat becomes unavailable:
- **ECB SDW**: Already used for some indicators (e.g., ECB rate)
- **FRED**: Some Eurozone series available (e.g., `EA19*` series)
- **DBnomics**: Aggregator with Eurostat data

## References

- [Eurostat API Documentation](https://ec.europa.eu/eurostat/web/json-and-unicode-web-services)
- [Eurostat Data Browser](https://ec.europa.eu/eurostat/data/database)
- Configuration: `config/european-indicators.json`
- Implementation: `lib/datasources/eurostat.ts`
- Ingestion Job: `app/api/jobs/ingest/european/route.ts`
