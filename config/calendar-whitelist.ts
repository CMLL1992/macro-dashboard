/**
 * Whitelist de eventos macroeconómicos de alta importancia (★★★)
 * 
 * Solo estos eventos se ingerirán en el calendario.
 * Todos los eventos en esta whitelist se asignan automáticamente importance = 'high'
 */

export type CountryCode = 'US' | 'EU' | 'ES' | 'DE' | 'UK'

export interface HighImpactEvent {
  /** Patrones regex para matching del título del evento */
  matchTitleRegex: RegExp[]
  /** Nombre canónico del evento (para display) */
  canonicalEventName: string
  /** País/región */
  country: CountryCode
  /** Moneda asociada */
  currency: 'USD' | 'EUR' | 'GBP'
  /** Categoría */
  category: 'Inflation' | 'Employment' | 'Growth' | 'Monetary' | 'Trade' | 'Other'
  /** Prioridad de fuente (si hay múltiples fuentes para el mismo evento) */
  sourcePriority?: number
  /** Series ID interno (si aplica) */
  seriesId?: string
  /** Indicator key interno (si aplica) */
  indicatorKey?: string
  /** Directionality para cálculo de sorpresa */
  directionality?: 'higher_is_positive' | 'lower_is_positive'
}

/**
 * Whitelist de eventos de alta importancia por país
 */
export const HIGH_IMPACT_WHITELIST: HighImpactEvent[] = [
  // ===== ESTADOS UNIDOS (USD) =====
  {
    matchTitleRegex: [
      /^Consumer Price Index$/i,
      /^CPI$/i,
      /^CPI\s+\(All\s+Items\)$/i,
      /^CPI\s+Year.*Over.*Year$/i,
      /^CPI.*YoY$/i,
    ],
    canonicalEventName: 'CPI YoY',
    country: 'US',
    currency: 'USD',
    category: 'Inflation',
    seriesId: 'CPIAUCSL',
    indicatorKey: 'us_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Core\s+CPI$/i,
      /^CPI.*Ex.*Food.*Energy$/i,
      /^CPI.*Core$/i,
      /^Core\s+Consumer\s+Price\s+Index$/i,
    ],
    canonicalEventName: 'Core CPI YoY',
    country: 'US',
    currency: 'USD',
    category: 'Inflation',
    seriesId: 'CPILFESL',
    indicatorKey: 'us_corecpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Employment\s+Situation$/i,
      /^Non.*Farm\s+Payrolls$/i,
      /^NFP$/i,
      /^Total\s+Nonfarm\s+Payrolls$/i,
      /^Employment\s+Change$/i,
    ],
    canonicalEventName: 'Non-Farm Payrolls',
    country: 'US',
    currency: 'USD',
    category: 'Employment',
    seriesId: 'PAYEMS',
    indicatorKey: 'us_nfp_change',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Unemployment\s+Rate$/i,
      /^Unemployment$/i,
      /^Jobless\s+Rate$/i,
    ],
    canonicalEventName: 'Unemployment Rate',
    country: 'US',
    currency: 'USD',
    category: 'Employment',
    seriesId: 'UNRATE',
    indicatorKey: 'us_unrate',
    directionality: 'lower_is_positive',
  },
  {
    matchTitleRegex: [
      /^FOMC\s+Rate\s+Decision$/i,
      /^Federal\s+Funds\s+Rate$/i,
      /^Fed\s+Interest\s+Rate$/i,
      /^FOMC\s+Statement$/i,
      /^FOMC\s+Meeting$/i, // Fed formato real
    ],
    canonicalEventName: 'FOMC Rate Decision',
    country: 'US',
    currency: 'USD',
    category: 'Monetary',
    seriesId: 'FEDFUNDS',
    indicatorKey: 'us_fedfunds',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^FOMC\s+Minutes$/i, // Fed formato real
    ],
    canonicalEventName: 'FOMC Minutes',
    country: 'US',
    currency: 'USD',
    category: 'Monetary',
    indicatorKey: 'us_fomc_minutes',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^FOMC\s+Press\s+Conference$/i, // Fed formato real
    ],
    canonicalEventName: 'FOMC Press Conference',
    country: 'US',
    currency: 'USD',
    category: 'Monetary',
    indicatorKey: 'us_fomc_press',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^GDP.*Advance$/i,
      /^Gross\s+Domestic\s+Product.*Advance$/i,
      /^GDP.*QoQ$/i,
      /^GDP.*Quarterly$/i,
    ],
    canonicalEventName: 'GDP Advance',
    country: 'US',
    currency: 'USD',
    category: 'Growth',
    seriesId: 'GDPC1',
    indicatorKey: 'us_gdp_qoq',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Personal\s+Consumption\s+Expenditures$/i,
      /^PCE$/i,
      /^PCE.*Price\s+Index$/i,
    ],
    canonicalEventName: 'PCE',
    country: 'US',
    currency: 'USD',
    category: 'Inflation',
    seriesId: 'PCEPILFE',
    indicatorKey: 'us_corepce_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Retail\s+Sales$/i,
      /^Retail\s+Trade$/i,
    ],
    canonicalEventName: 'Retail Sales',
    country: 'US',
    currency: 'USD',
    category: 'Growth',
    seriesId: 'RSXFS',
    indicatorKey: 'us_retail_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^ISM\s+Manufacturing\s+PMI$/i,
      /^Manufacturing\s+PMI$/i,
      /^PMI\s+Manufacturing$/i,
    ],
    canonicalEventName: 'ISM Manufacturing PMI',
    country: 'US',
    currency: 'USD',
    category: 'Growth',
    seriesId: 'USPMI',
    indicatorKey: 'us_pmi_mfg',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^ISM\s+Services\s+PMI$/i,
      /^Services\s+PMI$/i,
      /^PMI\s+Services$/i,
    ],
    canonicalEventName: 'ISM Services PMI',
    country: 'US',
    currency: 'USD',
    category: 'Growth',
    seriesId: 'USPMI_SERVICES',
    indicatorKey: 'us_pmi_svcs',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Initial\s+Jobless\s+Claims$/i,
      /^Initial\s+Claims$/i,
      /^Jobless\s+Claims$/i,
    ],
    canonicalEventName: 'Initial Jobless Claims',
    country: 'US',
    currency: 'USD',
    category: 'Employment',
    seriesId: 'ICSA',
    indicatorKey: 'us_initial_claims_4w',
    directionality: 'lower_is_positive',
  },
  {
    matchTitleRegex: [
      /^Producer\s+Price\s+Index$/i,
      /^PPI$/i,
      /^PPI.*Final\s+Demand$/i,
    ],
    canonicalEventName: 'PPI',
    country: 'US',
    currency: 'USD',
    category: 'Inflation',
    seriesId: 'PPIACO',
    indicatorKey: 'us_ppi_yoy',
    directionality: 'higher_is_positive',
  },

  // ===== EUROZONA (EUR) =====
  {
    matchTitleRegex: [
      /^Flash\s+CPI$/i,
      /^HICP.*Flash$/i,
      /^Euro.*Area.*CPI.*Flash$/i,
      /^Harmonised\s+Index.*Consumer\s+Prices.*Flash$/i,
    ],
    canonicalEventName: 'Euro Area Flash CPI',
    country: 'EU',
    currency: 'EUR',
    category: 'Inflation',
    seriesId: 'EU_CPI_YOY',
    indicatorKey: 'eu_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Euro.*Area.*GDP$/i,
      /^GDP.*Euro.*Area$/i,
      /^GDP.*QoQ$/i,
      /^GDP.*Quarterly$/i,
    ],
    canonicalEventName: 'Euro Area GDP',
    country: 'EU',
    currency: 'EUR',
    category: 'Growth',
    seriesId: 'EU_GDP_QOQ',
    indicatorKey: 'eu_gdp_qoq',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^ECB\s+Rate\s+Decision$/i,
      /^ECB.*Interest\s+Rate$/i,
      /^Main\s+Refinancing\s+Rate$/i,
      /^ECB.*Press\s+Conference$/i,
    ],
    canonicalEventName: 'ECB Rate Decision',
    country: 'EU',
    currency: 'EUR',
    category: 'Monetary',
    seriesId: 'EU_ECB_RATE',
    indicatorKey: 'eu_ecb_rate',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^PMI.*Manufacturing$/i,
      /^Manufacturing\s+PMI$/i,
      /^Euro.*Area.*PMI.*Manufacturing$/i,
    ],
    canonicalEventName: 'Euro Area Manufacturing PMI',
    country: 'EU',
    currency: 'EUR',
    category: 'Growth',
    seriesId: 'EU_PMI_MANUFACTURING',
    indicatorKey: 'eu_pmi_manufacturing',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^PMI.*Services$/i,
      /^Services\s+PMI$/i,
      /^Euro.*Area.*PMI.*Services$/i,
    ],
    canonicalEventName: 'Euro Area Services PMI',
    country: 'EU',
    currency: 'EUR',
    category: 'Growth',
    seriesId: 'EU_PMI_SERVICES',
    indicatorKey: 'eu_pmi_services',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Unemployment\s+Rate.*Euro.*Area$/i,
      /^Euro.*Area.*Unemployment$/i,
    ],
    canonicalEventName: 'Euro Area Unemployment Rate',
    country: 'EU',
    currency: 'EUR',
    category: 'Employment',
    seriesId: 'EU_UNEMPLOYMENT',
    indicatorKey: 'eu_unemployment',
    directionality: 'lower_is_positive',
  },

  // ===== ESPAÑA (EUR) =====
  {
    matchTitleRegex: [
      /^IPC$/i,
      /^Índice\s+de\s+Precios\s+de\s+Consumo$/i,
      /^Consumer\s+Price\s+Index.*Spain$/i,
      /^CPI.*Spain$/i,
      /^IPC.*Avance$/i,
      /^IPC.*Final$/i,
    ],
    canonicalEventName: 'IPC (CPI)',
    country: 'ES',
    currency: 'EUR',
    category: 'Inflation',
    indicatorKey: 'es_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^PIB$/i,
      /^Producto\s+Interior\s+Bruto$/i,
      /^GDP.*Spain$/i,
      /^PIB.*Trimestral$/i,
      /^GDP.*Quarterly$/i,
    ],
    canonicalEventName: 'PIB Trimestral',
    country: 'ES',
    currency: 'EUR',
    category: 'Growth',
    indicatorKey: 'es_gdp_qoq',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^EPA$/i,
      /^Encuesta\s+de\s+Población\s+Activa$/i,
      /^Unemployment.*Spain$/i,
      /^Paro$/i,
      /^Tasa\s+de\s+Paro$/i,
    ],
    canonicalEventName: 'EPA (Unemployment)',
    country: 'ES',
    currency: 'EUR',
    category: 'Employment',
    indicatorKey: 'es_unemployment',
    directionality: 'lower_is_positive',
  },
  {
    matchTitleRegex: [
      /^Ventas\s+Minoristas$/i,
      /^Retail\s+Sales.*Spain$/i,
    ],
    canonicalEventName: 'Ventas Minoristas',
    country: 'ES',
    currency: 'EUR',
    category: 'Growth',
    directionality: 'higher_is_positive',
  },

  // ===== ALEMANIA (EUR) =====
  {
    matchTitleRegex: [
      /^CPI.*Germany$/i,
      /^VPI$/i,
      /^Verbraucherpreisindex$/i,
      /^Consumer\s+Price\s+Index.*Germany$/i,
    ],
    canonicalEventName: 'CPI (VPI)',
    country: 'DE',
    currency: 'EUR',
    category: 'Inflation',
    indicatorKey: 'de_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^GDP.*Germany$/i,
      /^BIP$/i,
      /^Bruttoinlandsprodukt$/i,
      /^GDP.*Quarterly.*Germany$/i,
    ],
    canonicalEventName: 'GDP',
    country: 'DE',
    currency: 'EUR',
    category: 'Growth',
    indicatorKey: 'de_gdp_qoq',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^IFO$/i,
      /^IFO.*Business\s+Climate$/i,
    ],
    canonicalEventName: 'IFO Business Climate',
    country: 'DE',
    currency: 'EUR',
    category: 'Growth',
    directionality: 'higher_is_positive',
  },
  // Bundesbank - Patrones por familia de publicaciones
  {
    matchTitleRegex: [
      /balance\s+of\s+payments/i,
      /bop\b/i,
      /international\s+investment\s+position/i,
      /iip\b/i,
    ],
    canonicalEventName: 'Balance of Payments / IIP',
    country: 'DE',
    currency: 'EUR',
    category: 'Trade',
    indicatorKey: 'de_bop',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /money\s+stock/i,
      /mfi\s+interest\s+rate\s+statistics/i,
      /securities\s+issues\s+statistics/i,
    ],
    canonicalEventName: 'Money Stock / MFI Statistics',
    country: 'DE',
    currency: 'EUR',
    category: 'Monetary',
    indicatorKey: 'de_money_stock',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /banks\s+reporting/i,
      /credit/i,
      /lending/i,
    ],
    canonicalEventName: 'Banks / Credit Statistics',
    country: 'DE',
    currency: 'EUR',
    category: 'Monetary',
    indicatorKey: 'de_banks',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /maastricht\s+debt/i,
      /government\s+finance/i,
    ],
    canonicalEventName: 'Government Finance',
    country: 'DE',
    currency: 'EUR',
    category: 'Growth',
    indicatorKey: 'de_gov_finance',
    directionality: 'lower_is_positive',
  },

  // ===== REINO UNIDO (GBP) =====
  {
    matchTitleRegex: [
      /^CPI.*UK$/i,
      /^CPI.*United\s+Kingdom$/i,
      /^Consumer\s+Price\s+Index.*UK$/i,
      /consumer\s+price\s+inflation.*uk/i, // ONS formato real (case insensitive)
      /cpi\s*\(h\).*uk/i, // ONS formato alternativo
      /cpi\b.*uk|uk.*\bcpi\b/i, // Más permisivo
    ],
    canonicalEventName: 'CPI',
    country: 'UK',
    currency: 'GBP',
    category: 'Inflation',
    seriesId: 'UK_CPI_YOY',
    indicatorKey: 'uk_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Core\s+CPI.*UK$/i,
      /^Core\s+CPI.*United\s+Kingdom$/i,
    ],
    canonicalEventName: 'Core CPI',
    country: 'UK',
    currency: 'GBP',
    category: 'Inflation',
    seriesId: 'UK_CORE_CPI_YOY',
    indicatorKey: 'uk_core_cpi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^GDP.*UK$/i,
      /^GDP.*United\s+Kingdom$/i,
      /^GDP.*Quarterly.*UK$/i,
      /^Gross\s+Domestic\s+Product.*UK/i, // ONS formato real
    ],
    canonicalEventName: 'GDP',
    country: 'UK',
    currency: 'GBP',
    category: 'Growth',
    seriesId: 'UK_GDP_QOQ',
    indicatorKey: 'uk_gdp_qoq',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^Labour\s+Market$/i,
      /^Employment.*UK$/i,
      /^Unemployment.*UK$/i,
      /^Claimant\s+Count$/i,
      /^Earnings\s+and\s+employment.*UK/i, // ONS formato real
      /^Pay\s+As\s+You\s+Earn.*UK/i, // ONS PAYE
    ],
    canonicalEventName: 'Labour Market',
    country: 'UK',
    currency: 'GBP',
    category: 'Employment',
    indicatorKey: 'uk_unemployment',
    directionality: 'lower_is_positive',
  },
  {
    matchTitleRegex: [
      /producer\s+price\s+inflation.*uk/i, // ONS formato real (case insensitive)
      /^PPI.*UK$/i,
      /ppi\b.*uk|uk.*\bppi\b/i, // Más permisivo
    ],
    canonicalEventName: 'PPI',
    country: 'UK',
    currency: 'GBP',
    category: 'Inflation',
    indicatorKey: 'uk_ppi_yoy',
    directionality: 'higher_is_positive',
  },
  {
    matchTitleRegex: [
      /^BoE\s+Rate\s+Decision$/i,
      /^Bank\s+of\s+England.*Rate$/i,
      /^Bank\s+Rate$/i,
    ],
    canonicalEventName: 'BoE Rate Decision',
    country: 'UK',
    currency: 'GBP',
    category: 'Monetary',
    seriesId: 'UK_BOE_RATE',
    indicatorKey: 'uk_boe_rate',
    directionality: 'higher_is_positive',
  },
]

/**
 * Verifica si un evento está en la whitelist de alta importancia
 */
export function isHighImpactEvent(title: string, country: string): HighImpactEvent | null {
  // Normalizar país
  const countryUpper = country.toUpperCase()
  let countryCode: CountryCode | null = null
  
  if (countryUpper.includes('UNITED STATES') || countryUpper.includes('US') || countryUpper === 'USA') {
    countryCode = 'US'
  } else if (countryUpper.includes('EURO') || countryUpper.includes('EUROZONE') || countryUpper.includes('EURO AREA')) {
    countryCode = 'EU'
  } else if (countryUpper.includes('SPAIN') || countryUpper.includes('ESPAÑA') || countryUpper === 'ES') {
    countryCode = 'ES'
  } else if (countryUpper.includes('GERMANY') || countryUpper.includes('DEUTSCHLAND') || countryUpper === 'DE') {
    countryCode = 'DE'
  } else if (countryUpper.includes('UNITED KINGDOM') || countryUpper.includes('UK') || countryUpper.includes('GB')) {
    countryCode = 'UK'
  }
  
  if (!countryCode) {
    return null
  }
  
  // Buscar en whitelist
  const titleNormalized = title.trim()
  
  for (const event of HIGH_IMPACT_WHITELIST) {
    if (event.country !== countryCode) {
      continue
    }
    
    // Verificar si el título coincide con algún patrón regex
    for (const regex of event.matchTitleRegex) {
      if (regex.test(titleNormalized)) {
        return event
      }
    }
  }
  
  return null
}

/**
 * Obtiene todos los eventos de alta importancia para un país
 */
export function getHighImpactEventsForCountry(country: CountryCode): HighImpactEvent[] {
  return HIGH_IMPACT_WHITELIST.filter(e => e.country === country)
}
