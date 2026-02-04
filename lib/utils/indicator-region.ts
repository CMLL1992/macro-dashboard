/**
 * Mapeo de indicadores a regiones para mostrar banderas
 * Identificación por región: 🇺🇸 USA, 🇪🇺 EU, 🇬🇧 UK, 🇯🇵 JP, 🇨🇦 CA, 🇦🇺 AU, 🇳🇿 NZ, 🇨🇭 CH
 */

export type Region = 'USA' | 'EU' | 'UK' | 'JP' | 'CA' | 'AU' | 'NZ' | 'CH' | 'CN'

export const REGION_FLAGS: Record<Region, string> = {
  USA: '🇺🇸',
  EU: '🇪🇺',
  UK: '🇬🇧',
  JP: '🇯🇵',
  CA: '🇨🇦',
  AU: '🇦🇺',
  NZ: '🇳🇿',
  CH: '🇨🇭',
  CN: '🇨🇳',
}

/**
 * Mapeo de indicadores a regiones basado en el key del indicador
 */
const INDICATOR_TO_REGION: Record<string, Region> = {
  // USA – IDs FRED / core-indicators (overview)
  'cpiaucsl': 'USA',
  'cpilfesl': 'USA',
  'pcepilfe': 'USA',
  'ppiaco': 'USA',
  'gdpc1': 'USA',
  'gdpc1_yoy': 'USA',
  'indpro': 'USA',
  'rsafs': 'USA',
  'payems': 'USA',
  'unrate': 'USA',
  'icsa': 'USA',
  'fedfunds': 'USA',
  'current_account_usd': 'USA',
  'trade_balance_usd': 'USA',
  'vix': 'USA',
  'vixcls': 'USA',

  // USA (keys amigables)
  'cpi_yoy': 'USA',
  'corecpi_yoy': 'USA',
  'pce_yoy': 'USA',
  'corepce_yoy': 'USA',
  'ppi_yoy': 'USA',
  'gdp_qoq': 'USA',
  'gdp_yoy': 'USA',
  'indpro_yoy': 'USA',
  'retail_yoy': 'USA',
  'payems_delta': 'USA',
  'claims_4w': 'USA',
  't10y2y': 'USA',
  'pmi_mfg': 'USA',
  'jolts_openings': 'USA',
  
  // EU
  'eu_cpi_yoy': 'EU',
  'eu_cpi_core_yoy': 'EU',
  'eu_gdp_qoq': 'EU',
  'eu_gdp_yoy': 'EU',
  'eu_industrial_production_yoy': 'EU',
  'eu_retail_sales_yoy': 'EU',
  'eu_unemployment': 'EU',
  'eu_pmi_composite': 'EU',
  'eu_pmi_manufacturing': 'EU',
  'eu_pmi_services': 'EU',
  'eu_ecb_rate': 'EU',
  'eu_consumer_confidence': 'EU',
  'eu_zew_sentiment': 'EU',
  
  // UK
  'uk_gdp_qoq': 'UK',
  'uk_gdp_yoy': 'UK',
  'uk_services_pmi': 'UK',
  'uk_manufacturing_pmi': 'UK',
  'uk_retail_sales_yoy': 'UK',
  'uk_industrial_production_yoy': 'UK',
  'uk_cpi_yoy': 'UK',
  'uk_core_cpi_yoy': 'UK',
  'uk_ppi_output_yoy': 'UK',
  'uk_unemployment_rate': 'UK',
  'uk_avg_earnings_yoy': 'UK',
  'uk_employment_change': 'UK',
  'uk_boe_rate': 'UK',
  
  // JP
  'jp_gdp_qoq': 'JP',
  'jp_gdp_yoy': 'JP',
  'jp_industrial_production_yoy': 'JP',
  'jp_retail_sales_yoy': 'JP',
  'jp_tankan_manufacturing': 'JP',
  'jp_services_pmi': 'JP',
  'jp_cpi_yoy': 'JP',
  'jp_core_cpi_yoy': 'JP',
  'jp_ppi_yoy': 'JP',
  'jp_unemployment_rate': 'JP',
  'jp_job_to_applicant_ratio': 'JP',
  'jp_employment_change': 'JP',
  'jp_wage_growth': 'JP',
  'jp_boj_rate': 'JP',
  
  // CA
  'ca_cpi_yoy': 'CA',
  'ca_core_cpi_yoy': 'CA',
  'ca_ppi_yoy': 'CA',
  'ca_gdp_qoq': 'CA',
  'ca_gdp_yoy': 'CA',
  'ca_services_pmi': 'CA',
  'ca_manufacturing_pmi': 'CA',
  'ca_retail_sales_yoy': 'CA',
  'ca_industrial_production_yoy': 'CA',
  'ca_unemployment_rate': 'CA',
  'ca_employment_change': 'CA',
  'ca_wage_growth': 'CA',
  'ca_boc_rate': 'CA',
  
  // AU
  'au_cpi_yoy': 'AU',
  'au_core_cpi_yoy': 'AU',
  'au_gdp_qoq': 'AU',
  'au_gdp_yoy': 'AU',
  'au_services_pmi': 'AU',
  'au_manufacturing_pmi': 'AU',
  'au_retail_sales_yoy': 'AU',
  'au_industrial_production_yoy': 'AU',
  'au_unemployment_rate': 'AU',
  'au_employment_change': 'AU',
  'au_wage_growth': 'AU',
  'au_rba_rate': 'AU',
  'au_pmi_manufacturing': 'AU',
  'au_pmi_services': 'AU',
  
  // NZ
  'nz_cpi_yoy': 'NZ',
  'nz_core_cpi_yoy': 'NZ',
  'nz_gdp_qoq': 'NZ',
  'nz_gdp_yoy': 'NZ',
  'nz_services_pmi': 'NZ',
  'nz_manufacturing_pmi': 'NZ',
  'nz_retail_sales_yoy': 'NZ',
  'nz_industrial_production_yoy': 'NZ',
  'nz_unemployment_rate': 'NZ',
  'nz_employment_change': 'NZ',
  'nz_wage_growth': 'NZ',
  'nz_rbnz_rate': 'NZ',
  
  // CH
  'ch_cpi_yoy': 'CH',
  'ch_core_cpi_yoy': 'CH',
  'ch_ppi_yoy': 'CH',
  'ch_gdp_yoy': 'CH',
  'ch_services_pmi': 'CH',
  'ch_manufacturing_pmi': 'CH',
  'ch_retail_sales_yoy': 'CH',
  'ch_industrial_production_yoy': 'CH',
  'ch_unemployment_rate': 'CH',
  'ch_employment_change': 'CH',
  'ch_wage_growth': 'CH',
  'ch_snb_rate': 'CH',
  
  // CN (China)
  'cn_gdp_yoy': 'CN',
  'cn_lpr_1y': 'CN',
  
  // JP (Japan) - nuevos indicadores (ya cubiertos arriba donde aplica)
  // 'jp_boj_rate': 'JP',
  // 'jp_policy_rate': 'JP',
  // 'jp_cpi_yoy_fred': 'JP',
  // 'jp_jgb_10y': 'JP',
  
  // UK (United Kingdom) - nuevos indicadores (ya cubiertos arriba)
  // 'uk_cpi_yoy': 'UK',
  // 'uk_boe_rate': 'UK',
}

/**
 * Obtiene la región de un indicador basado en su key
 */
export function getIndicatorRegion(indicatorKey: string): Region | null {
  return INDICATOR_TO_REGION[indicatorKey.toLowerCase()] || null
}

/**
 * Obtiene la bandera y código de región para un indicador
 */
export function getIndicatorRegionFlag(indicatorKey: string): string {
  const region = getIndicatorRegion(indicatorKey)
  if (!region) return ''
  return `${REGION_FLAGS[region]} ${region}`
}
