/**
 * Centralized indicator label mapping
 * Maps indicator keys to human-readable display names
 * Used across dashboard, API, and UI components
 */

export const INDICATOR_LABELS: Record<string, string> = {
  // USA – IDs FRED / core-indicators (overview)
  'cpiaucsl': 'CPI YoY',
  'cpilfesl': 'Core CPI YoY',
  'pcepilfe': 'Core PCE YoY',
  'ppiaco': 'PPI YoY',
  'gdpc1': 'PIB Trimestral (GDP QoQ Anualizado)',
  'gdpc1_yoy': 'PIB Interanual (GDP YoY)',
  'indpro': 'Producción Industrial (YoY)',
  'rsafs': 'Ventas Minoristas (YoY)',
  'payems': 'Nóminas No Agrícolas (NFP Δ)',
  'unrate': 'Tasa de Desempleo (U3)',
  'icsa': 'Solicitudes Iniciales de Subsidio (4W MA)',
  'fedfunds': 'Tasa Efectiva de Fondos Federales',
  'current_account_usd': 'Cuenta Corriente (USD)',
  'trade_balance_usd': 'Balanza Comercial (USD)',
  'vix': 'VIX (Riesgo)',
  'vixcls': 'VIX (Riesgo)',

  // USA (keys amigables)
  'cpi_yoy': 'Inflación CPI (YoY)',
  'corecpi_yoy': 'Inflación Core CPI (YoY)',
  'pce_yoy': 'Inflación PCE (YoY)',
  'corepce_yoy': 'Inflación Core PCE (YoY)',
  'ppi_yoy': 'Índice de Precios al Productor (PPI YoY)',
  'gdp_yoy': 'PIB Interanual (GDP YoY)',
  'gdp_qoq': 'PIB Trimestral (GDP QoQ Anualizado)',
  'indpro_yoy': 'Producción Industrial (YoY)',
  'retail_yoy': 'Ventas Minoristas (YoY)',
  'payems_delta': 'Nóminas No Agrícolas (NFP Δ miles)',
  'claims_4w': 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)',
  'pmi_mfg': 'PMI manufacturero (ISM)',
  'jolts_openings': 'Ofertas de empleo JOLTS',
  't10y2y': 'Curva 10Y–2Y (spread %)',

  // European Indicators
  'eu_gdp_qoq': 'PIB Eurozona (QoQ)',
  'eu_gdp_yoy': 'PIB Eurozona (YoY)',
  'eu_cpi_yoy': 'Inflación Eurozona (CPI YoY)',
  'eu_cpi_core_yoy': 'Inflación Core Eurozona (Core CPI YoY)',
  'eu_unemployment': 'Tasa de Desempleo Eurozona',
  'eu_pmi_manufacturing': 'PMI Manufacturero Eurozona',
  'eu_pmi_services': 'PMI Servicios Eurozona',
  'eu_pmi_composite': 'PMI Compuesto Eurozona',
  'eu_ecb_rate': 'Tasa de Interés BCE (Main Refinancing Rate)',
  'eu_retail_sales_yoy': 'Ventas Minoristas Eurozona (YoY)',
  'eu_industrial_production_yoy': 'Producción Industrial Eurozona (YoY)',
  'eu_consumer_confidence': 'Confianza del Consumidor Eurozona',
  'eu_zew_sentiment': 'ZEW Economic Sentiment Eurozona',
  
  // UK (GBP)
  'uk_gdp_qoq': 'PIB Reino Unido (QoQ)',
  'uk_gdp_yoy': 'PIB Reino Unido (YoY)',
  'uk_cpi_yoy': 'Inflación Reino Unido (CPI YoY)',
  'uk_core_cpi_yoy': 'Inflación Core Reino Unido (Core CPI YoY)',
  'uk_boe_rate': 'Tasa de Interés BoE (Policy Rate)',
  'uk_unemployment_rate': 'Tasa de Desempleo Reino Unido',
  'uk_services_pmi': 'PMI Servicios Reino Unido',
  'uk_manufacturing_pmi': 'PMI Manufacturero Reino Unido',
  'uk_retail_sales_yoy': 'Ventas Minoristas Reino Unido (YoY)',
  'uk_industrial_production_yoy': 'Producción Industrial Reino Unido (YoY)',
  'uk_avg_earnings_yoy': 'Salarios Promedio Reino Unido (YoY)',
  'uk_employment_change': 'Cambio de Empleo Reino Unido',
  
  // Japan (JPY)
  'jp_gdp_qoq': 'PIB Japón (QoQ)',
  'jp_gdp_yoy': 'PIB Japón (YoY)',
  'jp_cpi_yoy': 'Inflación Japón (CPI YoY)',
  'jp_cpi_yoy_fred': 'Inflación Japón (CPI YoY)',
  'jp_core_cpi_yoy': 'Inflación Core Japón (Core CPI YoY)',
  'jp_boj_rate': 'Tasa de Interés BoJ (Policy Rate)',
  'jp_policy_rate': 'Tasa de Interés BoJ (Policy Rate)',
  'jp_jgb_10y': 'Rendimiento JGB 10Y',
  'jp_unemployment_rate': 'Tasa de Desempleo Japón',
  'jp_services_pmi': 'PMI Servicios Japón',
  'jp_industrial_production_yoy': 'Producción Industrial Japón (YoY)',
  'jp_retail_sales_yoy': 'Ventas Minoristas Japón (YoY)',
  'jp_wage_growth': 'Crecimiento Salarial Japón (YoY)',
  'jp_employment_change': 'Cambio de Empleo Japón',
  
  // China (CNY/CNH)
  'cn_gdp_yoy': 'PIB China (YoY)',
  'cn_lpr_1y': 'Tasa de Préstamo Prime China (LPR 1Y)',
  
  // Canada (CAD)
  'ca_gdp_qoq': 'PIB Canadá (QoQ)',
  'ca_gdp_yoy': 'PIB Canadá (YoY)',
  'ca_cpi_yoy': 'Inflación Canadá (CPI YoY)',
  'ca_core_cpi_yoy': 'Inflación Core Canadá (Core CPI YoY)',
  'ca_boc_rate': 'Tasa de Interés BoC (Policy Rate)',
  'ca_unemployment_rate': 'Tasa de Desempleo Canadá',
  'ca_services_pmi': 'PMI Servicios Canadá',
  'ca_manufacturing_pmi': 'PMI Manufacturero Canadá',
  'ca_retail_sales_yoy': 'Ventas Minoristas Canadá (YoY)',
  'ca_industrial_production_yoy': 'Producción Industrial Canadá (YoY)',
  'ca_wage_growth': 'Crecimiento Salarial Canadá (YoY)',
  'ca_employment_change': 'Cambio de Empleo Canadá',
  
  // Australia (AUD)
  'au_gdp_qoq': 'PIB Australia (QoQ)',
  'au_gdp_yoy': 'PIB Australia (YoY)',
  'au_cpi_yoy': 'Inflación Australia (CPI YoY)',
  'au_core_cpi_yoy': 'Inflación Core Australia (Core CPI YoY)',
  'au_rba_rate': 'Tasa de Interés RBA (Policy Rate)',
  'au_unemployment_rate': 'Tasa de Desempleo Australia',
  'au_services_pmi': 'PMI Servicios Australia',
  'au_manufacturing_pmi': 'PMI Manufacturero Australia',
  'au_retail_sales_yoy': 'Ventas Minoristas Australia (YoY)',
  'au_industrial_production_yoy': 'Producción Industrial Australia (YoY)',
  'au_wage_growth': 'Crecimiento Salarial Australia (YoY)',
  'au_employment_change': 'Cambio de Empleo Australia',
  
  // New Zealand (NZD)
  'nz_gdp_qoq': 'PIB Nueva Zelanda (QoQ)',
  'nz_gdp_yoy': 'PIB Nueva Zelanda (YoY)',
  'nz_cpi_yoy': 'Inflación Nueva Zelanda (CPI YoY)',
  'nz_core_cpi_yoy': 'Inflación Core Nueva Zelanda (Core CPI YoY)',
  'nz_rbnz_rate': 'Tasa de Interés RBNZ (Policy Rate)',
  'nz_unemployment_rate': 'Tasa de Desempleo Nueva Zelanda',
  'nz_services_pmi': 'PMI Servicios Nueva Zelanda',
  'nz_manufacturing_pmi': 'PMI Manufacturero Nueva Zelanda',
  'nz_retail_sales_yoy': 'Ventas Minoristas Nueva Zelanda (YoY)',
  'nz_industrial_production_yoy': 'Producción Industrial Nueva Zelanda (YoY)',
  'nz_wage_growth': 'Crecimiento Salarial Nueva Zelanda (YoY)',
  'nz_employment_change': 'Cambio de Empleo Nueva Zelanda',
  
  // Switzerland (CHF)
  'ch_gdp_yoy': 'PIB Suiza (YoY)',
  'ch_cpi_yoy': 'Inflación Suiza (CPI YoY)',
  'ch_core_cpi_yoy': 'Inflación Core Suiza (Core CPI YoY)',
  'ch_snb_rate': 'Tasa de Interés SNB (Policy Rate)',
  'ch_unemployment_rate': 'Tasa de Desempleo Suiza',
  'ch_services_pmi': 'PMI Servicios Suiza',
  'ch_manufacturing_pmi': 'PMI Manufacturero Suiza',
  'ch_retail_sales_yoy': 'Ventas Minoristas Suiza (YoY)',
  'ch_industrial_production_yoy': 'Producción Industrial Suiza (YoY)',
  'ch_wage_growth': 'Crecimiento Salarial Suiza (YoY)',
  'ch_employment_change': 'Cambio de Empleo Suiza',
}

/**
 * Get display name for an indicator key
 * Falls back to a formatted version of the key if not found
 */
export function getIndicatorLabel(key: string): string {
  if (!key) return 'Nombre no definido'
  
  const normalizedKey = key.toLowerCase()
  const label = INDICATOR_LABELS[normalizedKey]
  
  if (label) return label
  
  // Fallback: try to format the key intelligently
  // Remove underscores, capitalize words
  const formatted = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
  
  // If it still looks like a key (all caps), return fallback
  if (key === key.toUpperCase() && key.includes('_')) {
    return 'Nombre no definido'
  }
  
  return formatted
}

/**
 * Get display name from indicator config (if available)
 * This is the preferred method when config is available
 */
export function getIndicatorLabelFromConfig(indicator: {
  id?: string
  name?: string
  displayName?: string
}): string {
  if (indicator.displayName) return indicator.displayName
  if (indicator.name) return indicator.name
  if (indicator.id) return getIndicatorLabel(indicator.id)
  return 'Nombre no definido'
}
