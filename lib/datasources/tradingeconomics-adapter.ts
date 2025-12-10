/**
 * TradingEconomics API Adapter
 * Normaliza respuestas de TradingEconomics para que devuelvan el mismo formato que FRED
 */

import type { MacroSeries, DataPoint } from '@/lib/types/macro'
import { fetchTradingEconomics } from '@/packages/ingestors/tradingeconomics'

export interface TradingEconomicsConfig {
  endpoint: string
  country?: string
  apiKey?: string
}

/**
 * Fetch macro series from TradingEconomics API
 * Returns data in the same format as FRED adapter
 */
export async function fetchTradingEconomicsSeries(
  config: TradingEconomicsConfig
): Promise<MacroSeries> {
  const { endpoint, country, apiKey } = config
  
  if (!apiKey) {
    throw new Error('TradingEconomics API key is required')
  }

  try {
    const observations = await fetchTradingEconomics(endpoint, apiKey, country)
    
    // Convert TradingEconomics observations to DataPoint format
    const data: DataPoint[] = observations.map(obs => ({
      date: obs.date,
      value: obs.value,
    }))

    // Sort by date ascending
    data.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    return {
      id: endpoint,
      source: 'TRADING_ECONOMICS',
      indicator: endpoint,
      nativeId: endpoint,
      name: endpoint,
      frequency: 'M', // Default, should be determined from data
      data,
      lastUpdated: data.length > 0 ? data[data.length - 1].date : undefined,
      meta: {
        endpoint,
        country,
      },
    }
  } catch (error) {
    throw new Error(`Failed to fetch from TradingEconomics: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Router function to fetch macro series based on source
 */
export async function fetchMacroSeriesBySource(
  source: string,
  config: {
    fredSeriesId?: string
    tradingEconomicsEndpoint?: string
    tradingEconomicsCountry?: string
    tradingEconomicsApiKey?: string
  }
): Promise<MacroSeries> {
  switch (source) {
    case 'FRED':
      if (!config.fredSeriesId) {
        throw new Error('FRED series ID is required for FRED source')
      }
      // Import FRED adapter dynamically to avoid circular dependencies
      const { fetchFredSeries } = await import('@/lib/fred')
      const observations = await fetchFredSeries(config.fredSeriesId, {
        observation_start: '2010-01-01',
        observation_end: new Date().toISOString().slice(0, 10),
      })
      
      return {
        id: config.fredSeriesId,
        source: 'FRED',
        indicator: config.fredSeriesId,
        nativeId: config.fredSeriesId,
        name: config.fredSeriesId,
        frequency: 'M',
        data: observations.map(obs => ({ date: obs.date, value: obs.value })),
        lastUpdated: observations.length > 0 ? observations[observations.length - 1].date : undefined,
        meta: {
          series_id: config.fredSeriesId,
        },
      }
    
    case 'TRADING_ECONOMICS':
      if (!config.tradingEconomicsEndpoint) {
        throw new Error('TradingEconomics endpoint is required for TradingEconomics source')
      }
      return fetchTradingEconomicsSeries({
        endpoint: config.tradingEconomicsEndpoint,
        country: config.tradingEconomicsCountry,
        apiKey: config.tradingEconomicsApiKey || process.env.TRADING_ECONOMICS_API_KEY,
      })
    
    default:
      throw new Error(`Source not implemented: ${source}`)
  }
}


