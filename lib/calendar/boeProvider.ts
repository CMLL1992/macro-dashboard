/**
 * Implementación de CalendarProvider para Bank of England (BoE)
 * 
 * Bank of England no tiene API pública para calendario económico.
 * Este proveedor genera eventos estimados basados en patrones conocidos de frecuencia.
 * 
 * Mejora futura: Scraping del calendario web del BoE o integración con APIs de terceros
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

const BOE_IMPORTANT_EVENTS: Array<{
  name: string
  category: string
  importance: 'low' | 'medium' | 'high'
  indicatorKey?: string
  directionality?: 'higher_is_positive' | 'lower_is_positive'
  frequency: 'monthly' | 'quarterly' | 'weekly'
  approximateDay?: number
  approximateTime?: string
}> = [
  {
    name: 'Inflación Reino Unido (CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'uk_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 15, // Generalmente mediados del mes
    approximateTime: '08:00', // 08:00 GMT = 09:00 CET
  },
  {
    name: 'Inflación Core Reino Unido (Core CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'uk_core_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 15,
    approximateTime: '08:00',
  },
  {
    name: 'Tasa de Interés BoE (Bank Rate)',
    category: 'Interest Rates',
    importance: 'high',
    indicatorKey: 'uk_boe_rate',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1, // Primer jueves del mes generalmente
    approximateTime: '12:00', // 12:00 GMT = 13:00 CET
  },
  {
    name: 'PIB Reino Unido (YoY)',
    category: 'GDP',
    importance: 'high',
    indicatorKey: 'uk_gdp_yoy',
    directionality: 'higher_is_positive',
    frequency: 'quarterly',
    approximateDay: 30, // Final del trimestre
    approximateTime: '08:00',
  },
  {
    name: 'Tasa de Desempleo Reino Unido',
    category: 'Employment',
    importance: 'high',
    indicatorKey: 'uk_unemployment',
    directionality: 'lower_is_positive',
    frequency: 'monthly',
    approximateDay: 15,
    approximateTime: '08:00',
  },
  {
    name: 'Ventas Minoristas Reino Unido',
    category: 'Consumption',
    importance: 'medium',
    indicatorKey: 'uk_retail_sales',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 20,
    approximateTime: '08:00',
  },
  {
    name: 'PMI Manufacturero Reino Unido',
    category: 'Growth',
    importance: 'medium',
    indicatorKey: 'uk_pmi_manufacturing',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1,
    approximateTime: '09:30',
  },
  {
    name: 'PMI Servicios Reino Unido',
    category: 'Growth',
    importance: 'medium',
    indicatorKey: 'uk_pmi_services',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 3,
    approximateTime: '09:30',
  },
]

export class BoEProvider implements CalendarProvider {
  constructor() {
    // BoE no requiere API key
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []

      for (const eventTemplate of BOE_IMPORTANT_EVENTS) {
        const minLevel = minImportance === 'high' ? 3 : minImportance === 'medium' ? 2 : 1
        const eventLevel = eventTemplate.importance === 'high' ? 3 : eventTemplate.importance === 'medium' ? 2 : 1
        if (eventLevel < minLevel) continue

        const estimatedDates = this.generateEstimatedDates(
          eventTemplate.frequency,
          eventTemplate.approximateDay || 15,
          from,
          to
        )

        for (const date of estimatedDates) {
          const timeStr = eventTemplate.approximateTime || '08:00'
          const scheduledTimeUTC = `${date.toISOString().split('T')[0]}T${timeStr}:00Z`

          events.push({
            externalId: `BOE-${eventTemplate.name.replace(/\s+/g, '-')}-${date.toISOString().split('T')[0]}`,
            country: 'United Kingdom',
            currency: 'GBP',
            name: eventTemplate.name,
            category: eventTemplate.category,
            importance: eventTemplate.importance,
            scheduledTimeUTC,
            previous: null,
            consensus: null,
            consensusRangeMin: undefined,
            consensusRangeMax: undefined,
            maybeIndicatorKey: eventTemplate.indicatorKey,
            directionality: eventTemplate.directionality,
          })
        }
      }

      console.log(`[BoEProvider] Generated ${events.length} estimated events (NOTE: These are approximations. Consider implementing web scraping or third-party API for exact dates)`)
      return events
    } catch (error) {
      console.error('[BoEProvider] Error fetching calendar:', error)
      throw error
    }
  }

  private generateEstimatedDates(
    frequency: 'monthly' | 'quarterly' | 'weekly',
    approximateDay: number,
    from: Date,
    to: Date
  ): Date[] {
    const dates: Date[] = []
    const current = new Date(from)

    while (current <= to) {
      const date = new Date(current)

      if (frequency === 'monthly') {
        date.setDate(Math.min(approximateDay, this.getDaysInMonth(date.getFullYear(), date.getMonth())))
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        current.setMonth(current.getMonth() + 1)
      } else if (frequency === 'quarterly') {
        date.setDate(Math.min(approximateDay, this.getDaysInMonth(date.getFullYear(), date.getMonth())))
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        current.setMonth(current.getMonth() + 3)
      } else if (frequency === 'weekly') {
        const dayOfWeek = date.getDay()
        const diff = approximateDay - dayOfWeek
        date.setDate(date.getDate() + diff)
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        current.setDate(current.getDate() + 7)
      }
    }

    return dates
  }

  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // BoE no proporciona releases directamente a través de API pública
    console.warn(`[BoEProvider] fetchRelease not yet implemented for ${event.externalId}`)
    return null
  }
}

