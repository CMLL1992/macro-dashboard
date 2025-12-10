/**
 * Mapeo de eventos de proveedor a configuración interna
 * 
 * Mapea nombres de eventos externos a:
 * - series_id (FRED)
 * - indicator_key (clave interna)
 * - directionality (higher_is_positive / lower_is_positive)
 */

import { ProviderCalendarEvent } from './types'
import fs from 'node:fs'
import path from 'node:path'

type InternalMapping = {
  country: string
  currency: string
  name: string
  category?: string
  importance: 'low' | 'medium' | 'high'
  seriesId?: string | null
  indicatorKey?: string | null
  directionality: 'higher_is_positive' | 'lower_is_positive'
}

/**
 * Cargar mapeo desde config JSON (si existe)
 */
function loadEventMapping(): Record<string, InternalMapping> {
  try {
    const p = path.join(process.cwd(), 'config', 'event-mapping.json')
    if (fs.existsSync(p)) {
      const txt = fs.readFileSync(p, 'utf8')
      const json = JSON.parse(txt)
      return json.mappings || {}
    }
  } catch (error) {
    console.warn('[calendar/mappers] Failed to load event-mapping.json, using defaults:', error)
  }
  return {}
}

const EVENT_MAPPING = loadEventMapping()

/**
 * Normaliza nombre de evento para búsqueda
 */
function normalizeEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Mapea evento de proveedor a configuración interna
 */
export function mapProviderEventToInternal(ev: ProviderCalendarEvent): InternalMapping {
  // 1. Intentar mapeo desde config JSON primero
  const normalizedName = normalizeEventName(ev.name)
  const mappingKey = `${ev.currency}_${normalizedName}`
  
  if (EVENT_MAPPING[mappingKey]) {
    const mapped = EVENT_MAPPING[mappingKey]
    return {
      country: ev.country,
      currency: ev.currency,
      name: ev.name,
      category: mapped.category || ev.category,
      importance: ev.importance,
      seriesId: mapped.seriesId || ev.maybeSeriesId || null,
      indicatorKey: mapped.indicatorKey || ev.maybeIndicatorKey || null,
      directionality: mapped.directionality || ev.directionality || 'higher_is_positive',
    }
  }

  // 2. Mapeo hardcoded para eventos comunes
  const nameLower = ev.name.toLowerCase()
  const currency = ev.currency.toUpperCase()

  // USD Events
  if (currency === 'USD') {
    // Verificar primero por seriesId si está disponible (más preciso)
    if (ev.maybeSeriesId === 'CPILFESL' || ev.maybeIndicatorKey === 'us_corecpi_yoy') {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Inflación Core EEUU (Core CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'CPILFESL',
        indicatorKey: 'us_corecpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('core cpi') || nameLower.includes('cpi core') || nameLower.includes('cpi (ex food & energy)')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Inflación Core EEUU (Core CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'CPILFESL',
        indicatorKey: 'us_corecpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('cpi') && (nameLower.includes('yoy') || nameLower.includes('year'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Inflación EEUU (CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'CPIAUCSL',
        indicatorKey: 'us_cpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('pce') && nameLower.includes('core')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'PCEPILFE',
        indicatorKey: 'us_corepce_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('nonfarm payrolls') || nameLower.includes('nfp') || nameLower.includes('employment change')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Empleo EEUU (NFP)', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'PAYEMS',
        indicatorKey: 'us_nfp_change',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('unemployment rate') || nameLower.includes('unrate')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Desempleo EEUU', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'UNRATE',
        indicatorKey: 'us_unrate',
        directionality: 'lower_is_positive',
      }
    }
    if (nameLower.includes('initial jobless claims') || nameLower.includes('initial claims')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'ICSA',
        indicatorKey: 'us_initial_claims_4w',
        directionality: 'lower_is_positive',
      }
    }
    if (nameLower.includes('gdp')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Growth',
        importance: ev.importance,
        seriesId: 'GDPC1',
        indicatorKey: nameLower.includes('qoq') ? 'us_gdp_qoq' : 'us_gdp_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('retail sales')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Growth',
        importance: ev.importance,
        seriesId: 'RSXFS',
        indicatorKey: 'us_retail_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('pmi') || nameLower.includes('ism')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('service') ? 'USPMI_SERVICES' : 'USPMI',
        indicatorKey: nameLower.includes('service') ? 'us_pmi_svcs' : 'us_pmi_mfg',
        directionality: 'higher_is_positive',
      }
    }
    // Preservar nombres de eventos FOMC (son eventos específicos reconocidos internacionalmente)
    if (nameLower.includes('fed interest rate decision')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Fed Interest Rate Decision', // Mantener nombre original en inglés
        category: 'Interest Rates',
        importance: ev.importance,
        seriesId: 'FEDFUNDS',
        indicatorKey: 'us_fedfunds',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('fomc')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name, // Mantener nombre original en inglés para eventos FOMC
        category: ev.category || 'Monetary Policy',
        importance: ev.importance,
        seriesId: undefined,
        indicatorKey: undefined,
        directionality: undefined,
      }
    }
    if (nameLower.includes('fed') && (nameLower.includes('rate') || nameLower.includes('interest'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Interés Fed (Federal Funds Rate)', // Nombre del indicador en la tabla
        category: 'Monetary',
        importance: ev.importance,
        seriesId: 'FEDFUNDS',
        indicatorKey: 'us_fedfunds',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('ppi')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'PPI EEUU (Producer Price Index)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'PPIACO',
        indicatorKey: 'us_ppi_yoy',
        directionality: 'higher_is_positive',
      }
    }
  }

  // EUR Events
  if (currency === 'EUR') {
    if (nameLower.includes('cpi') && (nameLower.includes('yoy') || nameLower.includes('year'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('core') ? 'Inflación Core Eurozona (Core CPI YoY)' : 'Inflación Eurozona (CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: nameLower.includes('core') ? 'EU_CPI_CORE_YOY' : 'EU_CPI_YOY',
        indicatorKey: nameLower.includes('core') ? 'eu_cpi_core_yoy' : 'eu_cpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('gdp')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: ev.name,
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('qoq') ? 'EU_GDP_QOQ' : 'EU_GDP_YOY',
        indicatorKey: nameLower.includes('qoq') ? 'eu_gdp_qoq' : 'eu_gdp_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('ecb') && (nameLower.includes('rate') || nameLower.includes('interest'))) {
      // Solo usar "Tasa de Interés BCE" si es una decisión real (con valores numéricos)
      const isRateDecision = 
        (ev.previous !== null && ev.previous !== undefined && isFinite(ev.previous)) ||
        (ev.consensus !== null && ev.consensus !== undefined && isFinite(ev.consensus))

      let eventName = ev.name // Mantener nombre original del proveedor por defecto
      
      if (isRateDecision) {
        eventName = 'Tasa de Interés BCE (Main Refinancing Rate)'
      } else {
        // Si no es decisión pero es sobre tipos del BCE, usar nombre genérico
        // o mantener el original si es descriptivo (ej: "ECB Press Conference")
        if (!nameLower.includes('press') && !nameLower.includes('conference') && !nameLower.includes('speech')) {
          eventName = 'Comparecencia del BCE'
        }
      }

      return {
        country: ev.country,
        currency: ev.currency,
        name: eventName,
        category: 'Monetary',
        importance: ev.importance,
        seriesId: isRateDecision ? 'EU_ECB_RATE' : undefined,
        indicatorKey: isRateDecision ? 'eu_ecb_rate' : undefined,
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('pmi')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('service') ? 'PMI Servicios Eurozona' : 'PMI Manufacturero Eurozona', // Nombre del indicador en la tabla
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('service') ? 'EU_PMI_SERVICES' : 'EU_PMI_MANUFACTURING',
        indicatorKey: nameLower.includes('service') ? 'eu_pmi_services' : 'eu_pmi_manufacturing',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('unemployment')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Desempleo Eurozona', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'EU_UNEMPLOYMENT',
        indicatorKey: 'eu_unemployment',
        directionality: 'lower_is_positive',
      }
    }
  }

  // GBP Events
  if (currency === 'GBP') {
    if (nameLower.includes('cpi') && (nameLower.includes('yoy') || nameLower.includes('year'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('core') ? 'Inflación Core Reino Unido (Core CPI YoY)' : 'Inflación Reino Unido (CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: nameLower.includes('core') ? 'UK_CORE_CPI_YOY' : 'UK_CPI_YOY',
        indicatorKey: nameLower.includes('core') ? 'uk_core_cpi_yoy' : 'uk_cpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('boe') && (nameLower.includes('rate') || nameLower.includes('interest'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Interés BoE (Bank Rate)', // Nombre del indicador en la tabla
        category: 'Monetary',
        importance: ev.importance,
        seriesId: 'UK_BOE_RATE',
        indicatorKey: 'uk_boe_rate',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('gdp')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('qoq') ? 'PIB Reino Unido (QoQ)' : 'PIB Reino Unido (YoY)', // Nombre del indicador en la tabla
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('qoq') ? 'UK_GDP_QOQ' : 'UK_GDP_YOY',
        indicatorKey: nameLower.includes('qoq') ? 'uk_gdp_qoq' : 'uk_gdp_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('unemployment')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Desempleo Reino Unido', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'UK_UNEMPLOYMENT',
        indicatorKey: 'uk_unemployment',
        directionality: 'lower_is_positive',
      }
    }
  }

  // JPY Events
  if (currency === 'JPY') {
    if (nameLower.includes('cpi') && (nameLower.includes('yoy') || nameLower.includes('year'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('core') ? 'Inflación Core Japón (Core CPI YoY)' : 'Inflación Japón (CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: nameLower.includes('core') ? 'JP_CORE_CPI_YOY' : 'JP_CPI_YOY',
        indicatorKey: nameLower.includes('core') ? 'jp_core_cpi_yoy' : 'jp_cpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('boj') && (nameLower.includes('rate') || nameLower.includes('interest'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Interés BoJ (Policy Rate)', // Nombre del indicador en la tabla
        category: 'Monetary',
        importance: ev.importance,
        seriesId: 'JP_BOJ_RATE',
        indicatorKey: 'jp_boj_rate',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('gdp')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('qoq') ? 'PIB Japón (QoQ)' : 'PIB Japón (YoY)', // Nombre del indicador en la tabla
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('qoq') ? 'JP_GDP_QOQ' : 'JP_GDP_YOY',
        indicatorKey: nameLower.includes('qoq') ? 'jp_gdp_qoq' : 'jp_gdp_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('unemployment')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Desempleo Japón', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: 'JP_UNEMPLOYMENT',
        indicatorKey: 'jp_unemployment',
        directionality: 'lower_is_positive',
      }
    }
  }

  // AUD Events
  if (currency === 'AUD') {
    if (nameLower.includes('cpi') && (nameLower.includes('yoy') || nameLower.includes('year'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Inflación Australia (CPI YoY)', // Nombre del indicador en la tabla
        category: 'Inflation',
        importance: ev.importance,
        seriesId: 'AU_CPI_YOY',
        indicatorKey: 'au_cpi_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('rba') && (nameLower.includes('rate') || nameLower.includes('interest'))) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: 'Tasa de Interés RBA (Cash Rate)', // Nombre del indicador en la tabla
        category: 'Monetary',
        importance: ev.importance,
        seriesId: 'AU_RBA_RATE',
        indicatorKey: 'au_rba_rate',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('gdp')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('qoq') ? 'PIB Australia (QoQ)' : 'PIB Australia (YoY)', // Nombre del indicador en la tabla
        category: 'Growth',
        importance: ev.importance,
        seriesId: nameLower.includes('qoq') ? 'AU_GDP_QOQ' : 'AU_GDP_YOY',
        indicatorKey: nameLower.includes('qoq') ? 'au_gdp_qoq' : 'au_gdp_yoy',
        directionality: 'higher_is_positive',
      }
    }
    if (nameLower.includes('unemployment') || nameLower.includes('employment')) {
      return {
        country: ev.country,
        currency: ev.currency,
        name: nameLower.includes('change') ? 'Empleo Australia (Employment Change)' : 'Tasa de Desempleo Australia', // Nombre del indicador en la tabla
        category: 'Employment',
        importance: ev.importance,
        seriesId: nameLower.includes('change') ? 'AU_EMPLOYMENT_CHANGE' : 'AU_UNEMPLOYMENT',
        indicatorKey: nameLower.includes('change') ? 'au_employment_change' : 'au_unemployment',
        directionality: nameLower.includes('change') ? 'higher_is_positive' : 'lower_is_positive',
      }
    }
  }

  // Fallback: usar valores del proveedor o defaults
  return {
    country: ev.country,
    currency: ev.currency,
    name: ev.name,
    category: ev.category,
    importance: ev.importance,
    seriesId: ev.maybeSeriesId || null,
    indicatorKey: ev.maybeIndicatorKey || null,
    directionality: ev.directionality || 'higher_is_positive',
  }
}

