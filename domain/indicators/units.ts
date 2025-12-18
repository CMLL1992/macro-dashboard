/**
 * Mapping de unidades para indicadores macro
 * Fuente de verdad única para unidades de indicadores
 */

export type Unit = '%' | 'bps' | 'index' | 'level' | 'ratio' | 'usd' | 'eur' | ''

/**
 * Mapeo de indicatorKey → unit
 * Basado en el checklist de QA que identificó 15 indicadores sin unidad
 */
export const INDICATOR_UNIT: Record<string, Unit> = {
  // Yield curve / Rates
  t10y2y: 'bps',
  yield_curve_10y_2y: 'bps',
  t10y3m: 'bps',
  fedfunds: '%',
  fed_funds_effective: '%',
  
  // GDP
  gdp_yoy: '%',
  gdp_qoq: '%',
  gdp_qoq_annualized: '%',
  eu_gdp_qoq: '%',
  eu_gdp_yoy: '%',
  uk_gdp_qoq: '%',
  uk_gdp_yoy: '%',
  jp_gdp_qoq: '%',
  jp_gdp_yoy: '%',
  
  // Inflation
  cpi_yoy: '%',
  corecpi_yoy: '%',
  corepce_yoy: '%',
  ppi_yoy: '%',
  eu_cpi_yoy: '%',
  eu_cpi_core_yoy: '%',
  uk_cpi_yoy: '%',
  uk_core_cpi_yoy: '%',
  uk_ppi_output_yoy: '%',
  jp_cpi_yoy: '%',
  jp_core_cpi_yoy: '%',
  jp_ppi_yoy: '%',
  
  // Employment
  unrate: '%',
  unemployment_rate_u3: '%',
  payems_delta: 'thousands',
  nfp_change: 'thousands',
  claims_4w: 'thousands',
  initial_claims_4w: 'thousands',
  jolts_openings: 'thousands',
  eu_unemployment: '%',
  uk_unemployment_rate: '%',
  uk_avg_earnings_yoy: '%',
  jp_unemployment_rate: '%',
  jp_job_to_applicant_ratio: 'ratio',
  
  // Growth / Activity
  indpro_yoy: '%',
  retail_yoy: '%',
  pmi_mfg: 'index',
  ism_manufacturing_pmi: 'index',
  ism_services_pmi: 'index',
  eu_pmi_manufacturing: 'index',
  eu_pmi_services: 'index',
  eu_pmi_composite: 'index',
  uk_manufacturing_pmi: 'index',
  uk_services_pmi: 'index',
  jp_tankan_manufacturing: 'index',
  jp_services_pmi: 'index',
  eu_industrial_production_yoy: '%',
  eu_retail_sales_yoy: '%',
  jp_industrial_production_yoy: '%',
  jp_retail_sales_yoy: '%',
  uk_retail_sales_yoy: '%',
  
  // Sentiment / Surveys
  michigan_consumer_sentiment: 'index',
  nfib_small_business_optimism: 'index',
  eu_consumer_confidence: 'index',
  eu_zew_sentiment: 'index',
  
  // Housing
  housing_starts: 'thousands',
  building_permits: 'thousands',
  
  // Monetary
  eu_ecb_rate: '%',
  uk_boe_rate: '%',
  jp_boj_rate: '%',
}

/**
 * Obtiene la unidad para un indicador
 * @param key - Key del indicador (ej: "cpi_yoy", "t10y2y")
 * @returns Unidad o string vacío si no está definida
 */
export function getIndicatorUnit(key: string): Unit {
  return INDICATOR_UNIT[key] ?? ''
}

/**
 * Valida si un indicador tiene unidad definida
 * Útil para QA y warnings
 */
export function hasIndicatorUnit(key: string): boolean {
  return key in INDICATOR_UNIT && INDICATOR_UNIT[key] !== ''
}
