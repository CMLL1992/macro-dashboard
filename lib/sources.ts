/**
 * Metadata de fuentes oficiales para cada indicador macroeconómico
 * 
 * Este archivo proporciona información de auditoría sobre las fuentes oficiales
 * de cada indicador, permitiendo verificar que los datos provienen de fuentes
 * confiables y oficiales (FRED, FED, BLS, BEA, etc.)
 */

export type IndicatorSource = {
  seriesId: string // ID de serie oficial (ej: CPIAUCSL para FRED)
  source: string // Nombre de la fuente (FRED, FED, BLS, BEA, etc.)
  sourceUrl?: string // URL a la serie oficial (opcional)
  frequency: 'D' | 'W' | 'M' | 'Q' | 'A' // Frecuencia de publicación
  unit?: string // Unidad de medida
  description?: string // Descripción del indicador
}

/**
 * Mapa de indicadores a sus fuentes oficiales
 * 
 * CAUSA RAÍZ: Para auditoría y verificación, cada indicador debe tener
 * asociada su fuente oficial y su ID de serie para poder verificar
 * que los datos mostrados corresponden a los datos reales de la fuente.
 */
export const INDICATOR_SOURCES: Record<string, IndicatorSource> = {
  // Inflación
  CPIAUCSL: {
    seriesId: 'CPIAUCSL',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPIAUCSL',
    frequency: 'M',
    unit: '% YoY',
    description: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average',
  },
  CPILFESL: {
    seriesId: 'CPILFESL',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL',
    frequency: 'M',
    unit: '% YoY',
    description: 'Consumer Price Index for All Urban Consumers: All Items Less Food & Energy',
  },
  PCEPI: {
    seriesId: 'PCEPI',
    source: 'FRED (BEA)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCEPI',
    frequency: 'M',
    unit: '% YoY',
    description: 'Personal Consumption Expenditures: Chain-type Price Index',
  },
  PCEPILFE: {
    seriesId: 'PCEPILFE',
    source: 'FRED (BEA)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCEPILFE',
    frequency: 'M',
    unit: '% YoY',
    description: 'Personal Consumption Expenditures Excluding Food and Energy (Chain-Type Price Index)',
  },
  PPIACO: {
    seriesId: 'PPIACO',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PPIACO',
    frequency: 'M',
    unit: '% YoY',
    description: 'Producer Price Index for All Commodities',
  },
  
  // Crecimiento
  GDPC1: {
    seriesId: 'GDPC1',
    source: 'FRED (BEA)',
    sourceUrl: 'https://fred.stlouisfed.org/series/GDPC1',
    frequency: 'Q',
    unit: '% QoQ Anualizado / % YoY',
    description: 'Real Gross Domestic Product',
  },
  INDPRO: {
    seriesId: 'INDPRO',
    source: 'FRED (FED)',
    sourceUrl: 'https://fred.stlouisfed.org/series/INDPRO',
    frequency: 'M',
    unit: '% YoY',
    description: 'Industrial Production Index',
  },
  RSXFS: {
    seriesId: 'RSXFS',
    source: 'FRED (Census Bureau)',
    sourceUrl: 'https://fred.stlouisfed.org/series/RSXFS',
    frequency: 'M',
    unit: '% YoY',
    description: 'Retail Sales: Retail Trade and Food Services',
  },
  
  // Mercado laboral
  PAYEMS: {
    seriesId: 'PAYEMS',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PAYEMS',
    frequency: 'M',
    unit: 'Cambio mensual (miles)',
    description: 'All Employees, Total Nonfarm',
  },
  UNRATE: {
    seriesId: 'UNRATE',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE',
    frequency: 'M',
    unit: '%',
    description: 'Unemployment Rate',
  },
  ICSA: {
    seriesId: 'ICSA',
    source: 'FRED (DOL)',
    sourceUrl: 'https://fred.stlouisfed.org/series/ICSA',
    frequency: 'W',
    unit: 'Promedio 4 semanas',
    description: 'Initial Claims',
  },
  
  // Política monetaria
  T10Y2Y: {
    seriesId: 'T10Y2Y',
    source: 'FRED (FED)',
    sourceUrl: 'https://fred.stlouisfed.org/series/T10Y2Y',
    frequency: 'D',
    unit: '%',
    description: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity',
  },
  FEDFUNDS: {
    seriesId: 'FEDFUNDS',
    source: 'FRED (FED)',
    sourceUrl: 'https://fred.stlouisfed.org/series/FEDFUNDS',
    frequency: 'D',
    unit: '%',
    description: 'Effective Federal Funds Rate',
  },
  
  // Surveys / Activity
  USPMI: {
    seriesId: 'USPMI',
    source: 'ISM / Trading Economics',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/',
    frequency: 'M',
    unit: 'Índice',
    description: 'ISM Manufacturing PMI (Purchasing Managers Index) - Publicado el 1er día hábil de cada mes',
  },
  JTSJOL: {
    seriesId: 'JTSJOL',
    source: 'FRED (BLS)',
    sourceUrl: 'https://fred.stlouisfed.org/series/JTSJOL',
    frequency: 'M',
    unit: '% YoY',
    description: 'Job Openings: Total Nonfarm (JOLTS)',
  },
  USPMI_SERVICES: {
    seriesId: 'USPMI_SERVICES',
    source: 'ISM / Trading Economics',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/',
    frequency: 'M',
    unit: 'Índice',
    description: 'ISM Services PMI (Purchasing Managers Index) - Publicado el 3er día hábil de cada mes',
  },
  UMCSENT: {
    seriesId: 'UMCSENT',
    source: 'FRED (University of Michigan)',
    sourceUrl: 'https://fred.stlouisfed.org/series/UMCSENT',
    frequency: 'M',
    unit: 'Índice',
    description: 'University of Michigan: Consumer Sentiment',
  },
  HOUST: {
    seriesId: 'HOUST',
    source: 'FRED (Census Bureau)',
    sourceUrl: 'https://fred.stlouisfed.org/series/HOUST',
    frequency: 'M',
    unit: 'Miles de unidades',
    description: 'Housing Starts: Total New Privately Owned Housing Units Started',
  },
  PERMIT: {
    seriesId: 'PERMIT',
    source: 'FRED (Census Bureau)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PERMIT',
    frequency: 'M',
    unit: 'Miles de unidades',
    description: 'New Private Housing Units Authorized by Building Permits',
  },
  NFIB: {
    seriesId: 'NFIB',
    source: 'FRED (NFIB)',
    sourceUrl: 'https://fred.stlouisfed.org/series/NFIB',
    frequency: 'M',
    unit: 'Índice',
    description: 'NFIB Small Business Optimism Index',
  },
  
  // European Indicators (Eurozone)
  EU_GDP_QOQ: {
    seriesId: 'EU_GDP_QOQ',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/MNA/Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N',
    frequency: 'Q',
    unit: '% QoQ',
    description: 'Gross Domestic Product - Quarter-on-Quarter growth rate for Eurozone',
  },
  EU_GDP_YOY: {
    seriesId: 'EU_GDP_YOY',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/MNA/Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N',
    frequency: 'Q',
    unit: '% YoY',
    description: 'Gross Domestic Product - Year-on-Year growth rate for Eurozone',
  },
  EU_CPI_YOY: {
    seriesId: 'EU_CPI_YOY',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/ICP/M.U2.Y.000000.3.INX',
    frequency: 'M',
    unit: '% YoY',
    description: 'Harmonised Index of Consumer Prices (HICP) - Year-on-Year for Eurozone',
  },
  EU_CPI_CORE_YOY: {
    seriesId: 'EU_CPI_CORE_YOY',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/ICP/M.U2.Y.XEF000.3.INX',
    frequency: 'M',
    unit: '% YoY',
    description: 'HICP excluding Energy and Food - Year-on-Year for Eurozone',
  },
  EU_UNEMPLOYMENT: {
    seriesId: 'EU_UNEMPLOYMENT',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/LFSI/M.I8.S.UNEHRT.TOTAL0.15_74.T',
    frequency: 'M',
    unit: '%',
    description: 'Unemployment Rate for Eurozone (Labour Force Survey, 15-74 years, total)',
  },
  EU_PMI_MANUFACTURING: {
    seriesId: 'BSCICP02EZM460S',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/BSCICP02EZM460S',
    frequency: 'M',
    unit: 'Índice',
    description: 'Business Tendency Surveys (Manufacturing): Confidence Indicators for Euro Area (19 Countries)',
  },
  EU_PMI_SERVICES: {
    seriesId: 'BVCICP02EZM460S',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/BVCICP02EZM460S',
    frequency: 'M',
    unit: 'Índice',
    description: 'Business Tendency Surveys: Composite Business Confidence: Economic Activity: Services for Euro Area (19 Countries)',
  },
  EU_PMI_COMPOSITE: {
    seriesId: 'BSCICP03EZM665S',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/BSCICP03EZM665S',
    frequency: 'M',
    unit: 'Índice',
    description: 'Composite Leading Indicators: Composite Business Confidence Amplitude Adjusted for Euro Area (19 Countries)',
  },
  EU_ECB_RATE: {
    seriesId: 'EU_ECB_RATE',
    source: 'ECB',
    sourceUrl: 'https://data.ecb.europa.eu/data/datasets/FM/B.U2.EUR.4F.KR.MRR_FR.LEV',
    frequency: 'D', // Business days -> Daily (closest approximation)
    unit: '%',
    description: 'ECB Main Refinancing Operations Rate (business frequency, fechas de cambio)',
  },
  EU_RETAIL_SALES_YOY: {
    seriesId: 'EA19SLRTTO01GYSAM',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/EA19SLRTTO01GYSAM',
    frequency: 'M',
    unit: '% YoY',
    description: 'Retail Trade Volume - Year-on-Year Growth Rate for Euro Area (19 countries), seasonally adjusted',
  },
  EU_INDUSTRIAL_PRODUCTION_YOY: {
    seriesId: 'EA19PRINTO01IXNBSAM',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/EA19PRINTO01IXNBSAM',
    frequency: 'M',
    unit: '% YoY',
    description: 'Industrial Production Index - Total Industry Excluding Construction for Euro Area (19 countries), seasonally adjusted',
  },
  EU_CONSUMER_CONFIDENCE: {
    seriesId: 'CSCICP03EZM665S',
    source: 'FRED (Eurostat)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CSCICP03EZM665S',
    frequency: 'M',
    unit: 'Índice',
    description: 'Consumer Opinion Surveys: Composite Consumer Confidence for Euro Area (19 countries), seasonally adjusted',
  },
  EU_ZEW_SENTIMENT: {
    seriesId: 'EU_ZEW_SENTIMENT',
    source: 'Econdify (Eurostat ESI)',
    sourceUrl: 'https://www.econdify.com/data/EZ/Economic_Sentiment',
    frequency: 'M',
    unit: 'Índice',
    description: 'Economic Sentiment Indicator (ESI) for Eurozone - Eurostat alternative to ZEW',
  },
  // UK Indicators (GBP)
  UK_GDP_QOQ: {
    seriesId: 'UK_GDP_QOQ',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/gdp-growth',
    frequency: 'Q',
    unit: '% QoQ',
    description: 'Gross Domestic Product - Quarter-on-Quarter growth rate for United Kingdom',
  },
  UK_GDP_YOY: {
    seriesId: 'UK_GDP_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/gdp-growth-annual',
    frequency: 'Q',
    unit: '% YoY',
    description: 'Gross Domestic Product - Year-on-Year growth rate for United Kingdom',
  },
  UK_SERVICES_PMI: {
    seriesId: 'UK_SERVICES_PMI',
    source: 'Trading Economics / S&P Global',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/services-pmi',
    frequency: 'M',
    unit: 'Índice',
    description: 'Services PMI (Purchasing Managers Index) for United Kingdom - S&P Global',
  },
  UK_MANUFACTURING_PMI: {
    seriesId: 'UK_MANUFACTURING_PMI',
    source: 'Trading Economics / S&P Global',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/manufacturing-pmi',
    frequency: 'M',
    unit: 'Índice',
    description: 'Manufacturing PMI (Purchasing Managers Index) for United Kingdom - S&P Global',
  },
  UK_RETAIL_SALES_YOY: {
    seriesId: 'UK_RETAIL_SALES_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/retail-sales-yoy',
    frequency: 'M',
    unit: '% YoY',
    description: 'Retail Sales - Year-on-Year growth rate for United Kingdom',
  },
  UK_CPI_YOY: {
    seriesId: 'UK_CPI_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/inflation-cpi',
    frequency: 'M',
    unit: '% YoY',
    description: 'Consumer Price Index (CPI) - Year-on-Year for United Kingdom',
  },
  UK_CORE_CPI_YOY: {
    seriesId: 'UK_CORE_CPI_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/core-inflation-rate',
    frequency: 'M',
    unit: '% YoY',
    description: 'Core Consumer Price Index (excluding food and energy) - Year-on-Year for United Kingdom',
  },
  UK_PPI_OUTPUT_YOY: {
    seriesId: 'UK_PPI_OUTPUT_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/producer-prices',
    frequency: 'M',
    unit: '% YoY',
    description: 'Producer Price Index (PPI) Output - Year-on-Year for United Kingdom',
  },
  UK_UNEMPLOYMENT_RATE: {
    seriesId: 'UK_UNEMPLOYMENT_RATE',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/unemployment-rate',
    frequency: 'M',
    unit: '%',
    description: 'Unemployment Rate for United Kingdom',
  },
  UK_AVG_EARNINGS_YOY: {
    seriesId: 'UK_AVG_EARNINGS_YOY',
    source: 'Trading Economics / ONS',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/wage-growth',
    frequency: 'M',
    unit: '% YoY',
    description: 'Average Weekly Earnings (Total Pay) - Year-on-Year for United Kingdom',
  },
  UK_BOE_RATE: {
    seriesId: 'UK_BOE_RATE',
    source: 'Trading Economics / Bank of England',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/interest-rate',
    frequency: 'D', // Business days -> Daily (closest approximation)
    unit: '%',
    description: 'Bank of England (BoE) Bank Rate - Official interest rate',
  },
  // Japan Indicators (JPY)
  JP_GDP_QOQ: {
    seriesId: 'JP_GDP_QOQ',
    source: 'Trading Economics / Cabinet Office',
    sourceUrl: 'https://tradingeconomics.com/japan/gdp-growth',
    frequency: 'Q',
    unit: '% QoQ',
    description: 'Gross Domestic Product - Quarter-on-Quarter growth rate for Japan',
  },
  JP_GDP_YOY: {
    seriesId: 'JP_GDP_YOY',
    source: 'Trading Economics / Cabinet Office',
    sourceUrl: 'https://tradingeconomics.com/japan/gdp-growth-annual',
    frequency: 'Q',
    unit: '% YoY',
    description: 'Gross Domestic Product - Year-on-Year growth rate for Japan',
  },
  JP_INDUSTRIAL_PRODUCTION_YOY: {
    seriesId: 'JP_INDUSTRIAL_PRODUCTION_YOY',
    source: 'Trading Economics / METI',
    sourceUrl: 'https://tradingeconomics.com/japan/industrial-production',
    frequency: 'M',
    unit: '% YoY',
    description: 'Industrial Production Index - Year-on-Year for Japan',
  },
  JP_RETAIL_SALES_YOY: {
    seriesId: 'JP_RETAIL_SALES_YOY',
    source: 'Trading Economics / METI',
    sourceUrl: 'https://tradingeconomics.com/japan/retail-sales-yoy',
    frequency: 'M',
    unit: '% YoY',
    description: 'Retail Sales - Year-on-Year growth rate for Japan',
  },
  JP_TANKAN_MANUFACTURING: {
    seriesId: 'JP_TANKAN_MANUFACTURING',
    source: 'Trading Economics / Bank of Japan',
    sourceUrl: 'https://tradingeconomics.com/japan/tankan-large-manufacturing-index',
    frequency: 'Q',
    unit: 'Índice',
    description: 'Tankan Large Manufacturers Index - Business sentiment survey by Bank of Japan',
  },
  JP_SERVICES_PMI: {
    seriesId: 'JP_SERVICES_PMI',
    source: 'Trading Economics / S&P Global',
    sourceUrl: 'https://tradingeconomics.com/japan/services-pmi',
    frequency: 'M',
    unit: 'Índice',
    description: 'Services PMI (Purchasing Managers Index) for Japan - S&P Global',
  },
  JP_CPI_YOY: {
    seriesId: 'JP_CPI_YOY',
    source: 'Trading Economics / Statistics Bureau',
    sourceUrl: 'https://tradingeconomics.com/japan/inflation-cpi',
    frequency: 'M',
    unit: '% YoY',
    description: 'Consumer Price Index (CPI) - Year-on-Year for Japan',
  },
  JP_CORE_CPI_YOY: {
    seriesId: 'JP_CORE_CPI_YOY',
    source: 'Trading Economics / Statistics Bureau',
    sourceUrl: 'https://tradingeconomics.com/japan/core-inflation-rate',
    frequency: 'M',
    unit: '% YoY',
    description: 'Core Consumer Price Index (excluding fresh food) - Year-on-Year for Japan',
  },
  JP_PPI_YOY: {
    seriesId: 'JP_PPI_YOY',
    source: 'Trading Economics / Bank of Japan',
    sourceUrl: 'https://tradingeconomics.com/japan/producer-prices',
    frequency: 'M',
    unit: '% YoY',
    description: 'Producer Price Index (PPI) - Year-on-Year for Japan',
  },
  JP_UNEMPLOYMENT_RATE: {
    seriesId: 'JP_UNEMPLOYMENT_RATE',
    source: 'Trading Economics / Statistics Bureau',
    sourceUrl: 'https://tradingeconomics.com/japan/unemployment-rate',
    frequency: 'M',
    unit: '%',
    description: 'Unemployment Rate for Japan',
  },
  JP_JOB_TO_APPLICANT_RATIO: {
    seriesId: 'JP_JOB_TO_APPLICANT_RATIO',
    source: 'Trading Economics / Ministry of Health',
    sourceUrl: 'https://tradingeconomics.com/japan/jobs-to-applicants-ratio',
    frequency: 'M',
    unit: 'Ratio',
    description: 'Job-to-Applicant Ratio (JAR) - Labor market tightness indicator for Japan',
  },
  JP_BOJ_RATE: {
    seriesId: 'JP_BOJ_RATE',
    source: 'Trading Economics / Bank of Japan',
    sourceUrl: 'https://tradingeconomics.com/japan/interest-rate',
    frequency: 'D', // Business days -> Daily (closest approximation)
    unit: '%',
    description: 'Bank of Japan (BoJ) Policy Rate - Official interest rate (clave para JPY)',
  },
}

/**
 * Mapa de claves internas a series_id (debe coincidir con lib/db/read-macro.ts)
 */
const KEY_TO_SERIES_ID: Record<string, string> = {
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  corepce_yoy: 'PCEPILFE',
  corepce_mom: 'PCEPILFE', // Core PCE MoM usa la misma serie que Core PCE YoY
  ppi_yoy: 'PPIACO',
  gdp_qoq: 'GDPC1',
  gdp_qoq_annualized: 'GDPC1',
  gdp_yoy: 'GDPC1',
  indpro_yoy: 'INDPRO',
  retail_yoy: 'RSAFS',
  nfp_change: 'PAYEMS',
  payems_delta: 'PAYEMS',
  unemployment_rate_u3: 'UNRATE',
  unrate: 'UNRATE',
  initial_claims_4w: 'ICSA',
  claims_4w: 'ICSA',
  jolts_openings_yoy: 'JTSJOL',
  yield_curve_10y_2y: 'T10Y2Y',
  t10y2y: 'T10Y2Y',
  fed_funds_effective: 'FEDFUNDS',
  fedfunds: 'FEDFUNDS',
  ism_manufacturing_pmi: 'USPMI',
  pmi_mfg: 'USPMI',
  ism_services_pmi: 'USPMI_SERVICES',
  michigan_consumer_sentiment: 'UMCSENT',
  housing_starts: 'HOUST',
  building_permits: 'PERMIT',
  nfib_small_business_optimism: 'NFIB',
  // European Indicators
  eu_gdp_qoq: 'EU_GDP_QOQ',
  eu_gdp_yoy: 'EU_GDP_YOY',
  eu_cpi_yoy: 'EU_CPI_YOY',
  eu_cpi_core_yoy: 'EU_CPI_CORE_YOY',
  eu_unemployment: 'EU_UNEMPLOYMENT',
  eu_pmi_manufacturing: 'EU_PMI_MANUFACTURING',
  eu_pmi_services: 'EU_PMI_SERVICES',
  eu_pmi_composite: 'EU_PMI_COMPOSITE',
  eu_ecb_rate: 'EU_ECB_RATE',
  eu_retail_sales_yoy: 'EU_RETAIL_SALES_YOY',
  eu_industrial_production_yoy: 'EU_INDUSTRIAL_PRODUCTION_YOY',
  eu_consumer_confidence: 'EU_CONSUMER_CONFIDENCE',
  eu_zew_sentiment: 'EU_ZEW_SENTIMENT',
  // UK Indicators
  uk_gdp_qoq: 'UK_GDP_QOQ',
  uk_gdp_yoy: 'UK_GDP_YOY',
  uk_services_pmi: 'UK_SERVICES_PMI',
  uk_manufacturing_pmi: 'UK_MANUFACTURING_PMI',
  uk_retail_sales_yoy: 'UK_RETAIL_SALES_YOY',
  uk_cpi_yoy: 'UK_CPI_YOY',
  uk_core_cpi_yoy: 'UK_CORE_CPI_YOY',
  uk_ppi_output_yoy: 'UK_PPI_OUTPUT_YOY',
  uk_unemployment_rate: 'UK_UNEMPLOYMENT_RATE',
  uk_avg_earnings_yoy: 'UK_AVG_EARNINGS_YOY',
  uk_boe_rate: 'UK_BOE_RATE',
  // Japan Indicators
  jp_gdp_qoq: 'JP_GDP_QOQ',
  jp_gdp_yoy: 'JP_GDP_YOY',
  jp_industrial_production_yoy: 'JP_INDUSTRIAL_PRODUCTION_YOY',
  jp_retail_sales_yoy: 'JP_RETAIL_SALES_YOY',
  jp_tankan_manufacturing: 'JP_TANKAN_MANUFACTURING',
  jp_services_pmi: 'JP_SERVICES_PMI',
  jp_cpi_yoy: 'JP_CPI_YOY',
  jp_core_cpi_yoy: 'JP_CORE_CPI_YOY',
  jp_ppi_yoy: 'JP_PPI_YOY',
  jp_unemployment_rate: 'JP_UNEMPLOYMENT_RATE',
  jp_job_to_applicant_ratio: 'JP_JOB_TO_APPLICANT_RATIO',
  jp_boj_rate: 'JP_BOJ_RATE',
}

/**
 * Obtener metadata de fuente para un indicador
 * Acepta tanto claves internas (pmi_mfg, jolts_openings_yoy) como seriesId (USPMI, JTSJOL)
 */
export function getIndicatorSource(key: string): IndicatorSource | null {
  // Primero intentar buscar directamente por la clave
  if (INDICATOR_SOURCES[key]) {
    return INDICATOR_SOURCES[key]
  }
  
  // Si no se encuentra, intentar mapear clave interna a seriesId
  const seriesId = KEY_TO_SERIES_ID[key] || key
  return INDICATOR_SOURCES[seriesId] || null
}

/**
 * Obtener URL de fuente oficial para un indicador
 */
export function getSourceUrl(seriesId: string): string | null {
  const source = getIndicatorSource(seriesId)
  return source?.sourceUrl || null
}

