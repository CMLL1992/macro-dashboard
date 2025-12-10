/**
 * Implementación de CalendarProvider para Reserve Bank of Australia (RBA)
 * 
 * Reserve Bank of Australia no tiene API pública para calendario económico.
 * Este proveedor genera eventos estimados basados en patrones conocidos de frecuencia.
 * 
 * Mejora futura: Scraping del calendario web del RBA o integración con APIs de terceros
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

const RBA_IMPORTANT_EVENTS: Array<{
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
    name: 'Inflación Australia (CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'au_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'quarterly', // CPI se publica trimestralmente en Australia
    approximateDay: 25, // Generalmente final del trimestre
    approximateTime: '00:30', // 00:30 UTC = 10:30 AEST
  },
  {
    name: 'Tasa de Interés RBA (Cash Rate)',
    category: 'Interest Rates',
    importance: 'high',
    indicatorKey: 'au_rba_rate',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1, // Primer martes del mes generalmente
    approximateTime: '03:30', // 03:30 UTC = 13:30 AEST
  },
  {
    name: 'PIB Australia (YoY)',
    category: 'GDP',
    importance: 'high',
    indicatorKey: 'au_gdp_yoy',
    directionality: 'higher_is_positive',
    frequency: 'quarterly',
    approximateDay: 5, // Primeros días del mes siguiente al trimestre
    approximateTime: '00:30',
  },
  {
    name: 'Tasa de Desempleo Australia',
    category: 'Employment',
    importance: 'high',
    indicatorKey: 'au_unemployment',
    directionality: 'lower_is_positive',
    frequency: 'monthly',
    approximateDay: 15, // Mediados del mes
    approximateTime: '00:30',
  },
  {
    name: 'Empleo Australia (Employment Change)',
    category: 'Employment',
    importance: 'high',
    indicatorKey: 'au_employment_change',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 15,
    approximateTime: '00:30',
  },
  {
    name: 'Retail Sales Australia',
    category: 'Consumption',
    importance: 'medium',
    indicatorKey: 'au_retail_sales',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 5,
    approximateTime: '00:30',
  },
  {
    name: 'PMI Manufacturero Australia',
    category: 'Growth',
    importance: 'medium',
    indicatorKey: 'au_pmi_manufacturing',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1,
    approximateTime: '22:00', // 22:00 UTC = 08:00 AEST siguiente día
  },
  {
    name: 'PMI Servicios Australia',
    category: 'Growth',
    importance: 'medium',
    indicatorKey: 'au_pmi_services',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 3,
    approximateTime: '22:00',
  },
]

export class RBAProvider implements CalendarProvider {
  constructor() {
    // RBA no requiere API key
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []

      for (const eventTemplate of RBA_IMPORTANT_EVENTS) {
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
          const timeStr = eventTemplate.approximateTime || '00:30'
          const scheduledTimeUTC = `${date.toISOString().split('T')[0]}T${timeStr}:00Z`

          events.push({
            externalId: `RBA-${eventTemplate.name.replace(/\s+/g, '-')}-${date.toISOString().split('T')[0]}`,
            country: 'Australia',
            currency: 'AUD',
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

      console.log(`[RBAProvider] Generated ${events.length} estimated events (NOTE: These are approximations. Consider implementing web scraping or third-party API for exact dates)`)
      return events
    } catch (error) {
      console.error('[RBAProvider] Error fetching calendar:', error)
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
    // RBA no proporciona releases directamente a través de API pública
    console.warn(`[RBAProvider] fetchRelease not yet implemented for ${event.externalId}`)
    return null
  }
}

