/**
 * Implementación de CalendarProvider para TradingEconomics API
 * 
 * Documentación: https://tradingeconomics.com/api
 * 
 * Requiere API key en TRADING_ECONOMICS_API_KEY
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

export class TradingEconomicsProvider implements CalendarProvider {
  private baseUrl = 'https://api.tradingeconomics.com'

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('TRADING_ECONOMICS_API_KEY is required')
    }
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
    countries?: readonly string[] // Países específicos a solicitar
    includeValues?: boolean // Activar values=true para obtener ActualValue, PreviousValue, ForecastValue
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low', countries, includeValues = false } = params

    try {
      // Formatear fechas para la API (YYYY-MM-DD)
      const fromStr = from.toISOString().split('T')[0]
      const toStr = to.toISOString().split('T')[0]

      // Usar países específicos si se proporcionan, sino usar lista por defecto
      const countriesToFetch = countries && countries.length > 0
        ? countries.map(c => c.toLowerCase().replace(/\s+/g, ' '))
        : [
            'united states',
            'euro area',
            'united kingdom',
            'japan',
            'australia',
            'canada',
            'new zealand',
            'switzerland',
            'china',
          ]
      
      // Usar el endpoint /calendar/country/ con múltiples países separados por comas
      // Formato: /calendar/country/united%20states,euro%20area/YYYY-MM-DD/YYYY-MM-DD
      const countriesParam = countriesToFetch.map(c => encodeURIComponent(c.toLowerCase())).join(',')
      
      // Construir URL con parámetros
      const urlParams = new URLSearchParams({
        c: this.apiKey,
      })
      
      // Activar values=true si se solicita
      if (includeValues) {
        urlParams.set('values', 'true')
      }
      
      const url = `${this.baseUrl}/calendar/country/${countriesParam}/${fromStr}/${toStr}?${urlParams.toString()}`
      
      console.log(`[TradingEconomicsProvider] Fetching calendar from ${fromStr} to ${toStr}`)
      console.log(`[TradingEconomicsProvider] Filtering by ${countriesToFetch.length} countries: ${countriesToFetch.join(', ')}`)
      console.log(`[TradingEconomicsProvider] minImportance: ${minImportance}, includeValues: ${includeValues}`)
      console.log(`[TradingEconomicsProvider] API URL: ${this.baseUrl}/calendar/country/***/${fromStr}/${toStr}?***`)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`TradingEconomics API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Si la respuesta no es un array, puede ser un objeto de error
      if (!Array.isArray(data)) {
        console.error(`[TradingEconomicsProvider] API returned non-array response:`, data)
        // Si es un mensaje de error, intentar extraer información útil
        if (data.Message) {
          console.warn(`[TradingEconomicsProvider] API limitation message: ${data.Message}`)
          // Retornar array vacío si hay limitación de cuenta gratuita
          return []
        }
        throw new Error(`TradingEconomics API returned unexpected format: ${JSON.stringify(data)}`)
      }

      // Filtrar mensajes de error que vienen como eventos
      const validEvents = data.filter((ev: any) => {
        // Excluir objetos que son mensajes de error en lugar de eventos
        if (ev.Message && (ev.Message.includes('Free accounts') || ev.Message.includes('contact us'))) {
          console.warn(`[TradingEconomicsProvider] Filtered out error message: ${ev.Message}`)
          return false
        }
        // Excluir eventos sin Event name (probablemente mensajes de error)
        if (!ev.Event || ev.Event.trim() === '') {
          return false
        }
        return true
      })

      // Verificar si hay limitación de cuenta gratuita
      const hasErrorMessage = data.some((ev: any) => 
        ev.Message && (ev.Message.includes('Free accounts') || ev.Message.includes('contact us'))
      )
      
      if (hasErrorMessage) {
        console.warn(`[TradingEconomicsProvider] WARNING: Free account limitation detected`)
        console.warn(`[TradingEconomicsProvider] Only countries available: Mexico, New Zealand, Sweden, Thailand`)
        console.warn(`[TradingEconomicsProvider] For USD, EUR, GBP, JPY, contact: support@tradingeconomics.com`)
      }

      // Log para debugging: ver qué está devolviendo la API
      console.log(`[TradingEconomicsProvider] Raw API response: ${data.length} total items`)
      console.log(`[TradingEconomicsProvider] Valid events after filtering: ${validEvents.length} events`)
      
      if (validEvents.length > 0) {
        const importanceBreakdown = validEvents.reduce((acc: Record<string, number>, ev: any) => {
          const imp = String(ev.Importance || 'unknown')
          acc[imp] = (acc[imp] || 0) + 1
          return acc
        }, {})
        console.log(`[TradingEconomicsProvider] Importance breakdown from API:`, importanceBreakdown)
        
        // Desglose por país para verificar que estamos obteniendo USD, EUR, GBP, JPY
        const countryBreakdown = validEvents.reduce((acc: Record<string, number>, ev: any) => {
          const country = ev.Country || 'Unknown'
          acc[country] = (acc[country] || 0) + 1
          return acc
        }, {})
        console.log(`[TradingEconomicsProvider] Country breakdown from API:`, countryBreakdown)
        
        // Mostrar algunos eventos de ejemplo
        const sampleEvents = validEvents.slice(0, 10).map((ev: any) => ({
          Event: ev.Event,
          Country: ev.Country,
          Currency: ev.Currency,
          Importance: ev.Importance,
          Date: ev.Date,
        }))
        console.log(`[TradingEconomicsProvider] Sample events (first 10):`, JSON.stringify(sampleEvents, null, 2))
      } else {
        console.warn(`[TradingEconomicsProvider] WARNING: API returned 0 valid events!`)
      }

      // Filtrar por países si se proporcionan
      let countryFiltered = validEvents
      if (countries && countries.length > 0) {
        const allowedCountriesSet = new Set(countries.map(c => c.toLowerCase()))
        countryFiltered = validEvents.filter((ev: any) => {
          const evCountry = (ev.Country || '').trim()
          return evCountry && allowedCountriesSet.has(evCountry.toLowerCase())
        })
        console.log(`[TradingEconomicsProvider] Filtered by countries: ${validEvents.length} → ${countryFiltered.length} events`)
      }

      // Mapear respuesta de TradingEconomics a ProviderCalendarEvent
      // Usar solo eventos válidos (filtrados previamente)
      const events: ProviderCalendarEvent[] = countryFiltered
        .filter((ev: any) => {
          // Filtrar eventos que tengan país (necesario para mapear a moneda)
          // Si no tiene moneda, intentaremos inferirla desde el país
          const hasCountry = ev.Country && ev.Country.trim() !== ''
          const hasCurrency = ev.Currency && ev.Currency.trim() !== ''
          
          // Incluir si tiene país (podemos inferir moneda) O tiene moneda directamente
          return hasCountry || hasCurrency
        })
        .filter((ev: any) => {
          // TradingEconomics usa números: 1=Low, 2=Medium, 3=High
          // SOLO aceptar importance = 3 (High) cuando minImportance = 'high'
          const evImportance = ev.Importance
          let evLevel = 0
          
          if (typeof evImportance === 'number') {
            evLevel = evImportance
          } else if (typeof evImportance === 'string') {
            const importanceMap: Record<string, number> = { High: 3, Medium: 2, Low: 1, high: 3, medium: 2, low: 1 }
            evLevel = importanceMap[evImportance] || 0
          }
          
          // Aplicar filtro de importancia: si minImportance = 'high', SOLO aceptar 3
          if (minImportance === 'high') {
            return evLevel === 3 // SOLO importance = 3
          } else if (minImportance === 'medium') {
            return evLevel >= 2 // Medium (2) o High (3)
          } else {
            return evLevel >= 1 // Todos
          }
        })
        .map((ev: any) => {
          // TradingEconomics usa formato: "2024-12-10 13:30:00"
          // Convertir a ISO UTC
          const dateStr = ev.Date
          let scheduledTimeUTC: string
          
          if (dateStr.includes('T')) {
            // Ya está en formato ISO
            scheduledTimeUTC = dateStr
          } else {
            // Formato "YYYY-MM-DD HH:mm:ss" -> convertir a ISO
            const [datePart, timePart] = dateStr.split(' ')
            scheduledTimeUTC = `${datePart}T${timePart || '00:00:00'}Z`
          }

          // Mapear importancia: TradingEconomics usa números (1=Low, 2=Medium, 3=High)
          let importance: 'low' | 'medium' | 'high' = 'low'
          if (typeof ev.Importance === 'number') {
            if (ev.Importance >= 3) importance = 'high'
            else if (ev.Importance >= 2) importance = 'medium'
            else importance = 'low'
          } else {
            importance = this.mapImportance(ev.Importance)
          }

          // Determinar moneda desde el país si no viene en Currency
          let currency = ev.Currency || ''
          if (!currency && ev.Country) {
            // Mapeo básico país -> moneda (más completo)
            const countryToCurrency: Record<string, string> = {
              'United States': 'USD',
              'Euro Area': 'EUR',
              'European Union': 'EUR',
              'Germany': 'EUR',
              'Spain': 'EUR',
              'France': 'EUR',
              'Italy': 'EUR',
              'United Kingdom': 'GBP',
              'Japan': 'JPY',
              'Australia': 'AUD',
              'Canada': 'CAD',
              'New Zealand': 'NZD',
              'Switzerland': 'CHF',
              'China': 'CNY',
              'Mexico': 'MXN',
              'Brazil': 'BRL',
              'South Korea': 'KRW',
              'India': 'INR',
              'Russia': 'RUB',
              'Turkey': 'TRY',
              'South Africa': 'ZAR',
              'Sweden': 'SEK',
              'Norway': 'NOK',
              'Denmark': 'DKK',
              'Poland': 'PLN',
              'Czech Republic': 'CZK',
              'Hungary': 'HUF',
            }
            currency = countryToCurrency[ev.Country] || 'USD' // Fallback a USD si no se encuentra
          }
          
          // Asegurar que siempre hay moneda (requerido por schema)
          if (!currency || currency.trim() === '') {
            currency = 'USD' // Fallback final
          }

          // Si includeValues=true, usar ActualValue, PreviousValue, ForecastValue
          // Si no, usar Previous, Forecast (compatibilidad hacia atrás)
          const previousValue = includeValues && ev.PreviousValue != null
            ? this.parseValue(ev.PreviousValue)
            : ev.Previous != null
            ? this.parseValue(ev.Previous)
            : null
            
          const consensusValue = includeValues && ev.ForecastValue != null
            ? this.parseValue(ev.ForecastValue)
            : ev.Forecast != null
            ? this.parseValue(ev.Forecast)
            : null
            
          // ActualValue solo está disponible cuando includeValues=true y el evento ya se publicó
          const actualValue = includeValues && ev.ActualValue != null
            ? this.parseValue(ev.ActualValue)
            : null

          return {
            externalId: String(ev.CalendarId || ev.Id || `${ev.Country || 'Unknown'}-${ev.Event || 'Event'}-${ev.Date}`),
            country: ev.Country || '',
            currency: currency,
            name: ev.Event || '',
            category: ev.Category || undefined,
            importance,
            scheduledTimeUTC,
            previous: previousValue,
            consensus: consensusValue,
            actual: actualValue, // Nuevo campo para valores actuales
            consensusRangeMin: ev.ForecastLow != null ? this.parseValue(ev.ForecastLow) : undefined,
            consensusRangeMax: ev.ForecastHigh != null ? this.parseValue(ev.ForecastHigh) : undefined,
            // TradingEconomics no proporciona estos campos directamente
            maybeSeriesId: undefined,
            maybeIndicatorKey: undefined,
            directionality: undefined,
          }
        })

      console.log(`[TradingEconomicsProvider] Fetched ${events.length} events`)
      return events
    } catch (error) {
      console.error('[TradingEconomicsProvider] Error fetching calendar:', error)
      throw error
    }
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    try {
      // TradingEconomics: obtener release específico por CalendarId
      const url = `${this.baseUrl}/calendar/id/${event.externalId}?c=${this.apiKey}`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        // Si no existe o no está publicado, retornar null
        if (response.status === 404) {
          return null
        }
        throw new Error(`TradingEconomics API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // TradingEconomics puede retornar array o objeto único
      const releaseData = Array.isArray(data) ? data[0] : data

      // Si no hay Actual, aún no está publicado
      if (!releaseData.Actual && releaseData.Actual !== 0) {
        return null
      }

      // Formatear fecha de release
      let releaseTimeUTC: string
      if (releaseData.Date) {
        if (releaseData.Date.includes('T')) {
          releaseTimeUTC = releaseData.Date
        } else {
          const [datePart, timePart] = releaseData.Date.split(' ')
          releaseTimeUTC = `${datePart}T${timePart || '00:00:00'}Z`
        }
      } else {
        releaseTimeUTC = new Date().toISOString()
      }

      return {
        externalEventId: event.externalId,
        actual: parseFloat(releaseData.Actual),
        previous: releaseData.Previous != null ? parseFloat(releaseData.Previous) : null,
        consensus: releaseData.Forecast != null ? parseFloat(releaseData.Forecast) : null,
        releaseTimeUTC,
      }
    } catch (error) {
      console.error('[TradingEconomicsProvider] Error fetching release:', error)
      // Si hay error, retornar null (aún no publicado o error de API)
      return null
    }
  }

  /**
   * Mapea importancia de TradingEconomics a formato interno
   */
  private mapImportance(importance: string | number): 'low' | 'medium' | 'high' {
    if (typeof importance === 'number') {
      if (importance >= 3) return 'high'
      if (importance >= 2) return 'medium'
      return 'low'
    }
    const lower = importance.toLowerCase()
    if (lower.includes('high')) return 'high'
    if (lower.includes('medium')) return 'medium'
    return 'low'
  }

  /**
   * Parsea valores que pueden venir con % o otros símbolos
   */
  private parseValue(value: string | number): number | null {
    if (typeof value === 'number') return value
    if (!value || value.trim() === '') return null
    
    // Remover % y otros símbolos, convertir a número
    const cleaned = value.toString().replace(/[%,\s]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? null : parsed
  }
}

