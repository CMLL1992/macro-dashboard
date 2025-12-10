/**
 * Sistema de múltiples proveedores de calendario
 * 
 * Combina eventos de múltiples fuentes:
 * - TradingEconomics (para países con acceso gratuito)
 * - FRED (para eventos económicos de EEUU)
 * - ECB (para eventos económicos de Euro Area)
 * 
 * Elimina duplicados basándose en externalId y combina resultados
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'
import { TradingEconomicsProvider } from './tradingEconomicsProvider'
import { FREDProvider } from './fredProvider'
import { ECBProvider } from './ecbProvider'
import { BoEProvider } from './boeProvider'
import { BoJProvider } from './bojProvider'
import { RBAProvider } from './rbaProvider'
import { FOMCProvider } from './fomcProvider'

export class MultiProvider implements CalendarProvider {
  private providers: Array<{ name: string; provider: CalendarProvider; enabled: boolean }> = []

  constructor() {
    // TradingEconomics - siempre habilitado (tiene países gratuitos)
    const tradingEconomicsKey = process.env.TRADING_ECONOMICS_API_KEY
    if (tradingEconomicsKey) {
      this.providers.push({
        name: 'TradingEconomics',
        provider: new TradingEconomicsProvider(tradingEconomicsKey),
        enabled: true,
      })
    } else {
      console.warn('[MultiProvider] TRADING_ECONOMICS_API_KEY not set, skipping TradingEconomics')
    }

    // FRED - para eventos de EEUU
    const fredKey = process.env.FRED_API_KEY
    if (fredKey) {
      this.providers.push({
        name: 'FRED',
        provider: new FREDProvider(fredKey),
        enabled: true,
      })
      console.log('[MultiProvider] FRED provider enabled')
    } else {
      console.warn('[MultiProvider] FRED_API_KEY not set, skipping FRED (US events will be missing)')
    }

    // ECB - para eventos de Euro Area
    this.providers.push({
      name: 'ECB',
      provider: new ECBProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] ECB provider enabled')

    // BoE - para eventos de Reino Unido (GBP)
    this.providers.push({
      name: 'BoE',
      provider: new BoEProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] BoE provider enabled')

    // BoJ - para eventos de Japón (JPY)
    this.providers.push({
      name: 'BoJ',
      provider: new BoJProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] BoJ provider enabled')

    // RBA - para eventos de Australia (AUD)
    this.providers.push({
      name: 'RBA',
      provider: new RBAProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] RBA provider enabled')

    // FOMC - para eventos de política monetaria de la Fed (USD)
    this.providers.push({
      name: 'FOMC',
      provider: new FOMCProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] FOMC provider enabled')
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const allEvents: ProviderCalendarEvent[] = []
    const errors: Array<{ provider: string; error: string }> = []

    console.log(`[MultiProvider] Fetching from ${this.providers.length} providers`)

    // Obtener eventos de todos los proveedores habilitados
    for (const { name, provider, enabled } of this.providers) {
      if (!enabled) {
        console.log(`[MultiProvider] Skipping ${name} (disabled)`)
        continue
      }

      try {
        console.log(`[MultiProvider] Fetching from ${name}...`)
        const events = await provider.fetchCalendar(params)
        console.log(`[MultiProvider] ${name} returned ${events.length} events`)
        allEvents.push(...events)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[MultiProvider] Error fetching from ${name}:`, errorMsg)
        errors.push({ provider: name, error: errorMsg })
        // Continuar con otros proveedores aunque uno falle
      }
    }

    // Eliminar duplicados basándose en externalId
    const uniqueEvents = this.deduplicateEvents(allEvents)

    // Estadísticas por proveedor (basado en externalId)
    const byProvider: Record<string, number> = {}
    uniqueEvents.forEach(ev => {
      const provider = ev.externalId.split('-')[0]
      byProvider[provider] = (byProvider[provider] || 0) + 1
    })

    console.log(`[MultiProvider] Total unique events: ${uniqueEvents.length}`)
    console.log(`[MultiProvider] Events by provider:`, byProvider)
    
    if (errors.length > 0) {
      console.warn(`[MultiProvider] Errors from providers:`, errors)
    }

    return uniqueEvents
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // Determinar qué proveedor maneja este evento basándose en externalId
    const providerPrefix = event.externalId.split('-')[0]

    for (const { name, provider, enabled } of this.providers) {
      if (!enabled) continue

      // Mapear prefijo a proveedor
      let matches = false
      if (providerPrefix === 'FRED' && name === 'FRED') matches = true
      if (providerPrefix === 'ECB' && name === 'ECB') matches = true
      if (providerPrefix === 'BOE' && name === 'BoE') matches = true
      if (providerPrefix === 'BOJ' && name === 'BoJ') matches = true
      if (providerPrefix === 'RBA' && name === 'RBA') matches = true
      if (providerPrefix === 'FOMC' && name === 'FOMC') matches = true
      // TradingEconomics no tiene prefijo específico, intentar si otros no coinciden
      if (!matches && name === 'TradingEconomics' && 
          providerPrefix !== 'FRED' && providerPrefix !== 'ECB' && 
          providerPrefix !== 'BOE' && providerPrefix !== 'BOJ' && providerPrefix !== 'RBA' && providerPrefix !== 'FOMC') {
        matches = true
      }

      if (matches) {
        try {
          const release = await provider.fetchRelease(event)
          if (release) {
            console.log(`[MultiProvider] Release found from ${name}`)
            return release
          }
        } catch (error) {
          console.error(`[MultiProvider] Error fetching release from ${name}:`, error)
          // Continuar con siguiente proveedor
        }
      }
    }

    return null
  }

  /**
   * Elimina eventos duplicados basándose en externalId y también en nombre+fecha+moneda
   * Si hay duplicados, mantiene el primero encontrado
   */
  private deduplicateEvents(events: ProviderCalendarEvent[]): ProviderCalendarEvent[] {
    const seenById = new Set<string>()
    const seenByKey = new Set<string>()
    const unique: ProviderCalendarEvent[] = []

    for (const event of events) {
      // Primera verificación: por externalId
      if (seenById.has(event.externalId)) {
        console.debug(`[MultiProvider] Duplicate event filtered by ID: ${event.externalId}`)
        continue
      }

      // Segunda verificación: por nombre+fecha+moneda (para detectar duplicados de diferentes proveedores)
      const dateOnly = event.scheduledTimeUTC.split('T')[0]
      const key = `${event.name}|${event.currency}|${dateOnly}`
      
      if (seenByKey.has(key)) {
        console.debug(`[MultiProvider] Duplicate event filtered by key: ${event.name} (${event.currency}) on ${dateOnly}`)
        continue
      }

      seenById.add(event.externalId)
      seenByKey.add(key)
      unique.push(event)
    }

    return unique
  }
}

