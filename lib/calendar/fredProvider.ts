/**
 * Implementación de CalendarProvider para FRED API (Federal Reserve Economic Data)
 * 
 * Documentación: https://fred.stlouisfed.org/docs/api/
 * 
 * Requiere API key gratuita en FRED_API_KEY
 * Obtener en: https://fred.stlouisfed.org/docs/api/api_key.html
 * 
 * FRED proporciona release dates para series económicas importantes de EEUU
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

// Mapeo de series FRED importantes a nombres de eventos económicos
const FRED_SERIES_TO_EVENT: Record<string, {
  name: string
  category: string
  importance: 'low' | 'medium' | 'high'
  indicatorKey?: string
  directionality?: 'higher_is_positive' | 'lower_is_positive'
  frequency: 'monthly' | 'quarterly' | 'weekly' | 'daily'
  approximateDay?: number // Día aproximado del mes (1-31)
  approximateTime?: string // Hora aproximada en UTC (HH:mm)
}> = {
  'CPIAUCSL': { name: 'Inflación EEUU (CPI YoY)', category: 'Inflation', importance: 'high', indicatorKey: 'us_cpi_yoy', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 10, approximateTime: '13:30' },
  'CPILFESL': { name: 'Inflación Core EEUU (Core CPI YoY)', category: 'Inflation', importance: 'high', indicatorKey: 'us_corecpi_yoy', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 10, approximateTime: '13:30' },
  'UNRATE': { name: 'Tasa de Desempleo EEUU', category: 'Employment', importance: 'high', indicatorKey: 'us_unrate', directionality: 'lower_is_positive', frequency: 'monthly', approximateDay: 1, approximateTime: '13:30' },
  'PAYEMS': { name: 'Empleo EEUU (NFP)', category: 'Employment', importance: 'high', indicatorKey: 'us_nfp_change', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 1, approximateTime: '13:30' },
  'GDPC1': { name: 'PIB EEUU (YoY)', category: 'GDP', importance: 'high', indicatorKey: 'us_gdp_yoy', directionality: 'higher_is_positive', frequency: 'quarterly', approximateDay: 28, approximateTime: '13:30' },
  'GDP': { name: 'PIB EEUU (YoY)', category: 'GDP', importance: 'high', indicatorKey: 'us_gdp_yoy', directionality: 'higher_is_positive', frequency: 'quarterly', approximateDay: 28, approximateTime: '13:30' },
  'FEDFUNDS': { name: 'Tasa de Interés Fed (Federal Funds Rate)', category: 'Interest Rates', importance: 'high', indicatorKey: 'us_fedfunds', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 15, approximateTime: '19:00' },
  'DEXUSEU': { name: 'U.S. / Euro Foreign Exchange Rate', category: 'FX', importance: 'medium', indicatorKey: 'eur_usd', directionality: 'higher_is_positive', frequency: 'daily', approximateDay: undefined, approximateTime: '12:00' },
  'DEXCHUS': { name: 'China / U.S. Foreign Exchange Rate', category: 'FX', importance: 'medium', indicatorKey: 'usd_cny', directionality: 'higher_is_positive', frequency: 'daily', approximateDay: undefined, approximateTime: '12:00' },
  'DEXJPUS': { name: 'Japan / U.S. Foreign Exchange Rate', category: 'FX', importance: 'medium', indicatorKey: 'usd_jpy', directionality: 'higher_is_positive', frequency: 'daily', approximateDay: undefined, approximateTime: '12:00' },
  'PPIACO': { name: 'PPI EEUU (Producer Price Index)', category: 'Inflation', importance: 'medium', indicatorKey: 'us_ppi_yoy', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 12, approximateTime: '13:30' },
  'RETAIL': { name: 'Ventas al Por Menor EEUU', category: 'Consumption', importance: 'medium', indicatorKey: 'us_retail_yoy', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 15, approximateTime: '13:30' },
  'INDPRO': { name: 'Producción Industrial EEUU', category: 'Production', importance: 'medium', indicatorKey: 'us_industrial_production', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 15, approximateTime: '14:15' },
  'HOUST': { name: 'Inicio de Viviendas EEUU', category: 'Housing', importance: 'medium', indicatorKey: 'us_housing_starts', directionality: 'higher_is_positive', frequency: 'monthly', approximateDay: 18, approximateTime: '13:30' },
  'DEXUSUK': { name: 'U.S. / U.K. Foreign Exchange Rate', category: 'FX', importance: 'medium', indicatorKey: 'gbp_usd', directionality: 'higher_is_positive', frequency: 'daily', approximateDay: undefined, approximateTime: '12:00' },
}

// Series FRED importantes para el calendario económico
const IMPORTANT_FRED_SERIES = Object.keys(FRED_SERIES_TO_EVENT)

export class FREDProvider implements CalendarProvider {
  private baseUrl = 'https://api.stlouisfed.org/fred'

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('FRED_API_KEY is required')
    }
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []

      console.log(`[FREDProvider] Generating events from ${from.toISOString()} to ${to.toISOString()}`)

      // Para eventos futuros, generar fechas estimadas basadas en frecuencia
      // FRED API no proporciona calendario de releases futuros directamente
      // Por lo tanto, generamos eventos basados en patrones conocidos de frecuencia
      for (const seriesId of IMPORTANT_FRED_SERIES) {
        try {
          const seriesInfo = FRED_SERIES_TO_EVENT[seriesId]
          
          // Verificar importancia mínima
          const minLevel = minImportance === 'high' ? 3 : minImportance === 'medium' ? 2 : 1
          const seriesLevel = seriesInfo.importance === 'high' ? 3 : seriesInfo.importance === 'medium' ? 2 : 1
          if (seriesLevel < minLevel) continue

          // Saltar series diarias para calendario económico (no son eventos programados)
          if (seriesInfo.frequency === 'daily') continue

          // Generar fechas estimadas basadas en frecuencia
          if (seriesInfo.frequency) {
            const estimatedDates = this.generateEstimatedDates(
              seriesInfo.frequency,
              seriesInfo.approximateDay || 10,
              from,
              to
            )
            
            // Crear eventos para cada fecha estimada
            for (const date of estimatedDates) {
              const dateStr = date.toISOString().split('T')[0]
              // Usar hora aproximada si está definida, sino usar 13:30 UTC (08:30 ET)
              const timeStr = seriesInfo.approximateTime || '13:30'
              const scheduledTimeUTC = `${dateStr}T${timeStr}:00Z`

              events.push({
                externalId: `FRED-${seriesId}-${dateStr}`,
                country: 'United States',
                currency: 'USD',
                name: seriesInfo.name,
                category: seriesInfo.category,
                importance: seriesInfo.importance,
                scheduledTimeUTC,
                previous: null, // FRED no proporciona consenso/previous en release dates
                consensus: null,
                consensusRangeMin: undefined,
                consensusRangeMax: undefined,
                maybeSeriesId: seriesId,
                maybeIndicatorKey: seriesInfo.indicatorKey,
                directionality: seriesInfo.directionality,
              })
            }
          }
        } catch (error) {
          console.error(`[FREDProvider] Error processing ${seriesId}:`, error)
          continue
        }
      }

      console.log(`[FREDProvider] Fetched ${events.length} events from FRED`)
      return events
    } catch (error) {
      console.error('[FREDProvider] Error fetching calendar:', error)
      throw error
    }
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    try {
      // Extraer series ID del externalId (formato: FRED-SERIES_ID-DATE)
      const parts = event.externalId.split('-')
      if (parts.length < 3 || parts[0] !== 'FRED') {
        return null
      }

      const seriesId = parts[1]
      const releaseDate = parts.slice(2).join('-') // Puede tener formato YYYY-MM-DD

      // Obtener el valor actual de la serie en la fecha de release
      const observationsUrl = `${this.baseUrl}/series/observations?series_id=${seriesId}&realtime_start=${releaseDate}&realtime_end=${releaseDate}&limit=1&sort_order=desc&api_key=${this.apiKey}&file_type=json`

      const response = await fetch(observationsUrl, {
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      if (data.observations && Array.isArray(data.observations) && data.observations.length > 0) {
        const observation = data.observations[0]
        
        // Obtener valor anterior para calcular surprise
        const previousObservation = data.observations.length > 1 ? data.observations[1] : null

        return {
          externalEventId: event.externalId,
          actual: parseFloat(observation.value) || 0,
          previous: previousObservation ? parseFloat(previousObservation.value) : null,
          consensus: null, // FRED no proporciona consenso
          releaseTimeUTC: event.scheduledTimeUTC,
        }
      }

      return null
    } catch (error) {
      console.error('[FREDProvider] Error fetching release:', error)
      return null
    }
  }

  /**
   * Genera fechas estimadas basadas en frecuencia
   * Similar a ECBProvider, pero para eventos de EEUU
   */
  private generateEstimatedDates(
    frequency: 'monthly' | 'quarterly' | 'weekly' | 'daily',
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
      } else if (frequency === 'daily') {
        // Para datos diarios, solo incluir días laborables (lunes-viernes)
        const dayOfWeek = date.getDay()
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && date >= from && date <= to) {
          dates.push(new Date(date))
        }
        // Avanzar un día
        current.setDate(current.getDate() + 1)
      }
    }

    return dates
  }

  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
  }
}

