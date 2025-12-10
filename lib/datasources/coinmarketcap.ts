/**
 * CoinMarketCap API client
 * Free tier: 333 requests/month
 * Documentation: https://coinmarketcap.com/api/documentation/v1/
 */

import { fetchWithTimeout } from '@/lib/utils/http'

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1'

export interface CoinMarketCapPrice {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Get historical OHLCV data for a cryptocurrency
 * Note: Free tier doesn't include historical data, so we use quotes/latest
 * For historical data, we'll use Yahoo Finance as fallback
 */
export async function fetchCoinMarketCapLatest(
  coinId: string,
  apiKey: string
): Promise<{ price: number; volume24h: number; timestamp: string } | null> {
  try {
    const url = `${CMC_BASE}/cryptocurrency/quotes/latest?id=${coinId}`
    const response = await fetchWithTimeout(url, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`)
    }

    const data = await response.json()
    const quote = data.data?.[coinId]?.quote?.USD

    if (!quote) {
      return null
    }

    return {
      price: quote.price,
      volume24h: quote.volume_24h || 0,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error fetching CoinMarketCap data for ${coinId}:`, error)
    return null
  }
}

/**
 * Get top N cryptocurrencies by market cap
 */
export async function fetchTopCryptocurrencies(
  limit: number = 25,
  apiKey: string
): Promise<Array<{ id: string; symbol: string; name: string; rank: number }>> {
  try {
    const url = `${CMC_BASE}/cryptocurrency/listings/latest?limit=${limit}&sort=market_cap`
    const response = await fetchWithTimeout(url, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`)
    }

    const data = await response.json()
    const cryptocurrencies = data.data || []

    return cryptocurrencies.map((crypto: any) => ({
      id: String(crypto.id),
      symbol: crypto.symbol,
      name: crypto.name,
      rank: crypto.cmc_rank,
    }))
  } catch (error) {
    console.error('Error fetching top cryptocurrencies:', error)
    return []
  }
}
