/**
 * Sistema de múltiples proveedores de calendario
 * 
 * Combina eventos de múltiples fuentes OFICIALES (gratuitas):
 * - ICS Providers (Eurostat, INE, Banco de España, Destatis)
 * - JSON Providers (BEA)
 * - HTML Providers (ONS, Fed Calendar)
 * 
 * Elimina duplicados basándose en externalId y combina resultados
 * Solo incluye eventos de alta importancia (★★★) según whitelist
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'
import { ICSProvider } from './providers/icsProvider'
import { JSONProvider } from './providers/jsonProvider'
import { HTMLProvider } from './providers/htmlProvider'

export class MultiProvider implements CalendarProvider {
  private providers: Array<{ name: string; provider: CalendarProvider; enabled: boolean }> = []

  constructor() {
    // ICS Providers - calendarios oficiales en formato ICS/iCalendar
    this.providers.push({
      name: 'ICS',
      provider: new ICSProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] ICS provider enabled (Eurostat, INE, Banco de España, Destatis)')

    // JSON Providers - calendarios oficiales en formato JSON
    this.providers.push({
      name: 'JSON',
      provider: new JSONProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] JSON provider enabled (BEA)')

    // HTML Providers - calendarios oficiales en formato HTML
    this.providers.push({
      name: 'HTML',
      provider: new HTMLProvider(),
      enabled: true,
    })
    console.log('[MultiProvider] HTML provider enabled (ONS, Fed Calendar)')
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
    // Los providers oficiales (ICS/JSON/HTML) no proporcionan releases con valores
    // Los valores se obtendrán de APIs oficiales (BLS, BEA, etc.) cuando estén disponibles
    // Por ahora, retornar null
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

