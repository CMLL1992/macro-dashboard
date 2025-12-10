/**
 * Implementación de CalendarProvider para ECB (European Central Bank)
 * 
 * ECB usa SDMX API para datos estadísticos, pero el calendario de releases
 * está disponible principalmente en formato web.
 * 
 * Este proveedor usa una lista hardcodeada de eventos importantes de Euro Area
 * basada en el calendario estadístico del ECB.
 * 
 * Mejora futura: Scraping del calendario web o integración con SDMX API
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

// Eventos económicos importantes de Euro Area con fechas aproximadas
// Estos se actualizarán dinámicamente cuando se implemente scraping o API
const ECB_IMPORTANT_EVENTS: Array<{
  name: string
  category: string
  importance: 'low' | 'medium' | 'high'
  indicatorKey?: string
  directionality?: 'higher_is_positive' | 'lower_is_positive'
  // Patrón de frecuencia: 'monthly', 'quarterly', 'weekly'
  frequency: 'monthly' | 'quarterly' | 'weekly'
  // Día aproximado del mes (1-31) o día de la semana (0-6 para domingo-sábado)
  approximateDay?: number
}> = [
  {
    name: 'Inflación Eurozona (CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'eu_cpi_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1, // Generalmente primeros días del mes
  },
  {
    name: 'Inflación Core Eurozona (Core CPI YoY)',
    category: 'Inflation',
    importance: 'high',
    indicatorKey: 'eu_cpi_core_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 1,
  },
  {
    name: 'PIB Eurozona (YoY)',
    category: 'GDP',
    importance: 'high',
    indicatorKey: 'eu_gdp_yoy',
    directionality: 'higher_is_positive',
    frequency: 'quarterly',
    approximateDay: 30, // Final del trimestre
  },
  {
    name: 'Tasa de Desempleo Eurozona',
    category: 'Employment',
    importance: 'high',
    indicatorKey: 'eu_unemployment',
    directionality: 'lower_is_positive',
    frequency: 'monthly',
    approximateDay: 1,
  },
  {
    name: 'Tasa de Interés BCE (Main Refinancing Rate)',
    category: 'Interest Rates',
    importance: 'high',
    indicatorKey: 'eu_ecb_rate',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 10, // Generalmente segundo jueves del mes
  },
  {
    name: 'Producción Industrial Eurozona',
    category: 'Production',
    importance: 'medium',
    indicatorKey: 'eu_industrial_production_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 12,
  },
  {
    name: 'Ventas Minoristas Eurozona (YoY)',
    category: 'Consumption',
    importance: 'medium',
    indicatorKey: 'eu_retail_sales_yoy',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 5,
  },
  {
    name: 'Balanza Comercial Eurozona',
    category: 'Trade',
    importance: 'medium',
    indicatorKey: 'eu_trade_balance',
    directionality: 'higher_is_positive',
    frequency: 'monthly',
    approximateDay: 15,
  },
]

export class ECBProvider implements CalendarProvider {
  private baseUrl = 'https://data.ecb.europa.eu'

  constructor() {
    // ECB no requiere API key para acceso público
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []
      const now = new Date()

      // Por ahora, generamos eventos estimados basados en patrones de frecuencia
      // NOTA: Esto es una aproximación. En producción, deberías:
      // 1. Scrapear el calendario web del ECB
      // 2. O usar SDMX API si está disponible
      // 3. O mantener una base de datos actualizada de fechas exactas

      for (const eventTemplate of ECB_IMPORTANT_EVENTS) {
        // Verificar importancia mínima
        const minLevel = minImportance === 'high' ? 3 : minImportance === 'medium' ? 2 : 1
        const eventLevel = eventTemplate.importance === 'high' ? 3 : eventTemplate.importance === 'medium' ? 2 : 1
        if (eventLevel < minLevel) continue

        // Generar fechas estimadas según frecuencia
        const estimatedDates = this.generateEstimatedDates(
          eventTemplate.frequency,
          eventTemplate.approximateDay || 1,
          from,
          to
        )

        for (const date of estimatedDates) {
          // La mayoría de datos del ECB se publican a las 11:00 CET (10:00 UTC en invierno, 9:00 UTC en verano)
          // Usamos 10:00 UTC como aproximación
          const scheduledTimeUTC = `${date.toISOString().split('T')[0]}T10:00:00Z`

          events.push({
            externalId: `ECB-${eventTemplate.name.replace(/\s+/g, '-')}-${date.toISOString().split('T')[0]}`,
            country: 'Euro Area',
            currency: 'EUR',
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

      console.log(`[ECBProvider] Generated ${events.length} estimated events (NOTE: These are approximations. Consider implementing web scraping or SDMX API for exact dates)`)
      return events
    } catch (error) {
      console.error('[ECBProvider] Error fetching calendar:', error)
      throw error
    }
  }

  /**
   * Genera fechas estimadas basadas en frecuencia
   * NOTA: Esto es una aproximación. Las fechas reales pueden variar.
   */
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
        // Establecer día aproximado del mes
        date.setDate(Math.min(approximateDay, this.getDaysInMonth(date.getFullYear(), date.getMonth())))
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        // Avanzar al siguiente mes
        current.setMonth(current.getMonth() + 1)
      } else if (frequency === 'quarterly') {
        // Establecer día aproximado del trimestre
        date.setDate(Math.min(approximateDay, this.getDaysInMonth(date.getFullYear(), date.getMonth())))
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        // Avanzar al siguiente trimestre
        current.setMonth(current.getMonth() + 3)
      } else if (frequency === 'weekly') {
        // Establecer día de la semana (0 = domingo, 6 = sábado)
        const dayOfWeek = date.getDay()
        const diff = approximateDay - dayOfWeek
        date.setDate(date.getDate() + diff)
        if (date >= from && date <= to) {
          dates.push(new Date(date))
        }
        // Avanzar una semana
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
    // ECB no proporciona releases directamente a través de API pública fácil
    // Esto requeriría scraping o integración con SDMX API
    // Por ahora retornamos null - se puede implementar después
    console.warn(`[ECBProvider] fetchRelease not yet implemented for ${event.externalId}`)
    return null
  }
}

