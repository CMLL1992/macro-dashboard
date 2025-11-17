/**
 * Derived macro indicators computation engine
 * Calculates indicators from base series using formulas
 */

import type { MacroSeries, DataPoint } from '@/lib/types/macro'
import { sortAscByDate } from '@/lib/utils/time'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import { fetchECBSeries } from '@/lib/datasources/ecb'
import type { CatalogIndicator, CatalogSource } from '@/lib/catalog'
import { getCatalogParams } from '@/lib/catalog'

export type DerivationFormula = 'ADD' | 'SUB' | 'DIV' | 'MUL'

export interface DerivationSpec {
  formula: DerivationFormula
  sources: Array<{
    source: CatalogSource
    indicator: CatalogIndicator
    countryISO3?: string
  }>
  unit?: string
  name?: string
}

/**
 * Align two series by date (intersection)
 */
function alignSeries(
  seriesA: DataPoint[],
  seriesB: DataPoint[]
): { alignedA: DataPoint[]; alignedB: DataPoint[] } {
  const dateMapA = new Map<string, number>()
  const dateMapB = new Map<string, number>()

  seriesA.forEach((dp) => {
    if (dp.value != null) dateMapA.set(dp.date, dp.value)
  })
  seriesB.forEach((dp) => {
    if (dp.value != null) dateMapB.set(dp.date, dp.value)
  })

  const commonDates = Array.from(dateMapA.keys()).filter((d) =>
    dateMapB.has(d)
  )
  commonDates.sort()

  const alignedA: DataPoint[] = []
  const alignedB: DataPoint[] = []

  commonDates.forEach((date) => {
    const valA = dateMapA.get(date)
    const valB = dateMapB.get(date)
    if (valA != null && valB != null) {
      alignedA.push({ date, value: valA })
      alignedB.push({ date, value: valB })
    }
  })

  return { alignedA, alignedB }
}

/**
 * Fetch a base series for derivation
 */
async function fetchBaseSeries(
  source: CatalogSource,
  indicator: CatalogIndicator,
  countryISO3?: string
): Promise<MacroSeries> {
  const params = getCatalogParams(indicator, source, countryISO3)

  if (!params) {
    throw new Error(
      `No parameters available for ${indicator} from ${source}${countryISO3 ? ` (${countryISO3})` : ''}`
    )
  }

  switch (source) {
    case 'WORLD_BANK':
      return fetchWorldBankSeries(params as any)
    case 'IMF':
      return fetchIMFSeries(params as any)
    case 'ECB_SDW':
      return fetchECBSeries(params as any)
    default:
      throw new Error(`Unknown source: ${source}`)
  }
}

/**
 * Compute a derived series from base series
 */
export async function computeSeries(
  spec: DerivationSpec,
  countryISO3?: string
): Promise<MacroSeries> {
  if (spec.sources.length < 2) {
    throw new Error('Derivation requires at least 2 source series')
  }

  // Fetch all base series
  const baseSeries = await Promise.all(
    spec.sources.map((src) =>
      fetchBaseSeries(src.source, src.indicator, src.countryISO3 || countryISO3)
    )
  )

  // Get the first series as reference
  const refSeries = baseSeries[0]
  let resultData: DataPoint[] = refSeries.data

  // Align and compute
  for (let i = 1; i < baseSeries.length; i++) {
    const { alignedA, alignedB } = alignSeries(resultData, baseSeries[i].data)

    resultData = alignedA.map((dpA, idx) => {
      const dpB = alignedB[idx]
      if (!dpB) return { date: dpA.date, value: null }

      let value: number | null = null

      switch (spec.formula) {
        case 'ADD':
          value = dpA.value! + dpB.value!
          break
        case 'SUB':
          value = dpA.value! - dpB.value!
          break
        case 'MUL':
          value = dpA.value! * dpB.value!
          break
        case 'DIV':
          if (dpB.value !== 0) {
            value = dpA.value! / dpB.value!
          }
          break
      }

      // Sanitize NaN and Infinity
      if (value != null && (!Number.isFinite(value) || isNaN(value))) {
        value = null
      }

      return { date: dpA.date, value }
    })
  }

  // Sort by date
  resultData = sortAscByDate(resultData)

  // Build result series
  const result: MacroSeries = {
    id: `DERIVED:${spec.sources.map((s) => s.indicator).join('_')}`,
    source: refSeries.source, // Use first source as reference
    indicator: spec.name || `DERIVED_${spec.formula}`,
    nativeId: `DERIVED:${spec.formula}`,
    name: spec.name || `Derived (${spec.formula})`,
    frequency: refSeries.frequency,
    unit: spec.unit || refSeries.unit,
    country: countryISO3 || refSeries.country,
    data: resultData,
    lastUpdated:
      resultData.length > 0
        ? resultData[resultData.length - 1].date
        : undefined,
    meta: {
      derivation: spec,
      baseSeries: baseSeries.map((s) => s.id),
    },
  }

  return result
}

/**
 * Compute trade balance from exports and imports
 */
export async function computeTradeBalance(
  source: CatalogSource,
  countryISO3: string
): Promise<MacroSeries> {
  const spec: DerivationSpec = {
    formula: 'SUB',
    sources: [
      { source, indicator: 'EXPORTS_GS_USD', countryISO3 },
      { source, indicator: 'IMPORTS_GS_USD', countryISO3 },
    ],
    unit: 'USD',
    name: 'Trade Balance (Goods and Services)',
  }

  return computeSeries(spec, countryISO3)
}

/**
 * Compute current account as % of GDP
 */
export async function computeCurrentAccountPctGDP(
  source: CatalogSource,
  countryISO3: string
): Promise<MacroSeries> {
  // First try to get GDP current USD
  let gdpSeries: MacroSeries
  try {
    const gdpParams = getCatalogParams('GDP_REAL', source, countryISO3)
    if (!gdpParams) {
      throw new Error('GDP not available')
    }

    switch (source) {
      case 'WORLD_BANK':
        gdpSeries = await fetchWorldBankSeries({
          countryISO3,
          indicatorCode: 'NY.GDP.MKTP.CD', // Current USD
        } as any)
        break
      default:
        throw new Error('GDP current USD not available for this source')
    }
  } catch (error) {
    throw new Error(
      `Cannot compute Current Account % GDP: GDP series not available - ${error}`
    )
  }

  const caSeries = await fetchBaseSeries(source, 'CURRENT_ACCOUNT_USD', countryISO3)

  const spec: DerivationSpec = {
    formula: 'DIV',
    sources: [
      { source, indicator: 'CURRENT_ACCOUNT_USD', countryISO3 },
      { source, indicator: 'GDP_REAL', countryISO3 },
    ],
    unit: '%',
    name: 'Current Account (% of GDP)',
  }

  // Use actual CA series and GDP series
  const { alignedA, alignedB } = alignSeries(caSeries.data, gdpSeries.data)

  const resultData = alignedA.map((dpA, idx) => {
    const dpB = alignedB[idx]
    if (!dpB || dpB.value === 0) return { date: dpA.date, value: null }

    let value: number | null = (dpA.value! / dpB.value!) * 100

    if (!Number.isFinite(value) || isNaN(value)) {
      value = null
    }

    return { date: dpA.date, value }
  })

  const sortedData = sortAscByDate(resultData)

  return {
    id: `DERIVED:CURRENT_ACCOUNT_PCT_GDP:${countryISO3}`,
    source: caSeries.source,
    indicator: 'CURRENT_ACCOUNT_PCT_GDP',
    nativeId: 'DERIVED:DIV',
    name: 'Current Account (% of GDP)',
    frequency: caSeries.frequency,
    unit: '%',
    country: countryISO3,
    data: sortedData,
    lastUpdated: sortedData.length > 0 ? sortedData[sortedData.length - 1].date : undefined,
    meta: {
      derivation: spec,
      baseSeries: [caSeries.id, gdpSeries.id],
    },
  }
}





