/**
 * Helper function to fetch release from calendar API
 * Uses the configured provider abstraction layer
 */

import { ProviderRelease } from './types'
import { CalendarProvider } from './provider'
import { TradingEconomicsProvider } from './tradingEconomicsProvider'

// Get provider instance (singleton pattern)
let providerInstance: CalendarProvider | null = null

function getProvider(): CalendarProvider {
  if (!providerInstance) {
    const apiKey = process.env.TRADING_ECONOMICS_API_KEY
    
    if (!apiKey) {
      console.warn('[calendar] TRADING_ECONOMICS_API_KEY not set, using mock provider')
      // Puedes crear un MockProvider para desarrollo
      throw new Error('TRADING_ECONOMICS_API_KEY is required')
    }
    
    providerInstance = new TradingEconomicsProvider(apiKey)
  }
  
  return providerInstance
}

/**
 * Fetch release from calendar API
 * Returns null if the data hasn't been published yet
 */
export async function fetchReleaseFromCalendarAPI(params: {
  externalId: string
  scheduledTimeUTC: string
}): Promise<ProviderRelease | null> {
  try {
    const provider = getProvider()
    const release = await provider.fetchRelease({
      externalId: params.externalId,
      scheduledTimeUTC: params.scheduledTimeUTC,
    })

    // Si la API aún no tiene dato real publicado:
    if (!release || release.actual == null) {
      return null
    }

    return release
  } catch (err) {
    console.error('[calendar] Error fetching release from provider:', err)
    return null
  }
}

