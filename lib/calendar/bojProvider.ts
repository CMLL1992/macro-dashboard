/**
 * Implementación de CalendarProvider para Bank of Japan (BoJ)
 * 
 * Bank of Japan no tiene API pública para calendario económico.
 * Este proveedor genera eventos estimados basados en patrones conocidos de frecuencia.
 * 
 * Mejora futura: Scraping del calendario web del BoJ o integración con APIs de terceros
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

const BOJ_IMPORTANT_EVENTS: Array<{
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
    name: 'Inflación Japón (CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'jp_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 25, // Generalmente final del mes
    approximateTime: '00:30', // 00:30 UTC = 09:30 JST
  },
  {
    name: 'Inflación Core Japón (Core CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'jp_core_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 25,
    approximateTime: '00:30',
  },
  {
    name: 'Tasa de Interés BoJ (Policy Rate)',
    category: 'Interest Rates',
    importance: 'high',
    indicatorKey: 'jp_boj_rate',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 20, // Generalmente alrededor del día 20
    approximateTime: '02:00', // 02:00 UTC = 11:00 JST
  },
  {
    name: 'PIB Japón (YoY)',
    category: 'GDP',
    importance: 'high',
    indicatorKey: 'jp_gdp_yoy',
    directionality: 'higher_is_positive',
    frequency: 'quarterly',
    approximateDay: 15, // Mediados del mes siguiente al trimestre
    approximateTime: '00:30',
  },
  {
    name: 'Tasa de Desempleo Japón',
    category: 'Employment',
    importance: 'high',
    indicatorKey: 'jp_unemployment',
    directionality: 'lower_is_positive',
    frequency: 'monthly',
    approximateDay: 1, // Primer día del mes siguiente
    approximateTime: '00:30',
  },
  {
    name: 'Retail Sales Japón',
    category: 'Consumption',
    importance: 'medium',
    indicatorKey: 'jp_retail_sales',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 28,
    approximateTime: '00:30',
  },
  {
    name: 'PMI Manufacturero Japón',
    category: 'Growth',
    importance: 'medium',
    indicatorKey: 'jp_pmi_manufacturing',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1,
    approximateTime: '00:00',
  },
  {
    name: 'Producción Industrial Japón',
    category: 'Production',
    importance: 'medium',
    indicatorKey: 'jp_industrial_production',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 28,
    approximateTime: '00:30',
  },
]

export class BoJProvider implements CalendarProvider {
  constructor() {
    // BoJ no requiere API key
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []

      for (const eventTemplate of BOJ_IMPORTANT_EVENTS) {
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
            externalId: `BOJ-${eventTemplate.name.replace(/\s+/g, '-')}-${date.toISOString().split('T')[0]}`,
            country: 'Japan',
            currency: 'JPY',
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

      console.log(`[BoJProvider] Generated ${events.length} estimated events (NOTE: These are approximations. Consider implementing web scraping or third-party API for exact dates)`)
      return events
    } catch (error) {
      console.error('[BoJProvider] Error fetching calendar:', error)
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
    // BoJ no proporciona releases directamente a través de API pública
    console.warn(`[BoJProvider] fetchRelease not yet implemented for ${event.externalId}`)
    return null
  }
}

