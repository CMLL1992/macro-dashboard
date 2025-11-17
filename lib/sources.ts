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
  
  // Otros
  VIX: {
    seriesId: 'VIX',
    source: 'CBOE',
    sourceUrl: 'https://www.cboe.com/tradable_products/vix/',
    frequency: 'D',
    unit: 'Índice',
    description: 'CBOE Volatility Index',
  },
  VIXCLS: {
    seriesId: 'VIXCLS',
    source: 'FRED (CBOE)',
    sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
    frequency: 'D',
    unit: 'Índice',
    description: 'CBOE Volatility Index: VIX',
  },
}

/**
 * Obtener metadata de fuente para un indicador
 */
export function getIndicatorSource(seriesId: string): IndicatorSource | null {
  return INDICATOR_SOURCES[seriesId] || null
}

/**
 * Obtener URL de fuente oficial para un indicador
 */
export function getSourceUrl(seriesId: string): string | null {
  const source = getIndicatorSource(seriesId)
  return source?.sourceUrl || null
}

