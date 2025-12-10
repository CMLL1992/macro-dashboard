export type Category =
  | 'Financieros / Curva'
  | 'Crecimiento / Actividad'
  | 'Mercado laboral'
  | 'Precios / Inflación'
  | 'Otros'

export const CATEGORY_ORDER: Category[] = [
  'Financieros / Curva',
  'Crecimiento / Actividad',
  'Mercado laboral',
  'Precios / Inflación',
  'Otros',
]

export const CATEGORY_MAP: Record<string, Category> = {
  // Financieros / Curva
  T10Y2Y: 'Financieros / Curva',
  T10Y3M: 'Financieros / Curva',
  T5YIE: 'Financieros / Curva',
  NFCI: 'Financieros / Curva',
  VIX: 'Otros',
  VIXCLS: 'Otros',

  // Crecimiento / Actividad
  GDPC1: 'Crecimiento / Actividad',
  RSXFS: 'Crecimiento / Actividad',
  INDPRO: 'Crecimiento / Actividad',
  TCU: 'Crecimiento / Actividad',
  DGEXFI: 'Crecimiento / Actividad',
  TTLCONS: 'Crecimiento / Actividad',
  USSLIND: 'Crecimiento / Actividad',
  // European Growth Indicators
  EU_GDP_QOQ: 'Crecimiento / Actividad',
  EU_GDP_YOY: 'Crecimiento / Actividad',
  EU_PMI_MANUFACTURING: 'Crecimiento / Actividad',
  EU_PMI_SERVICES: 'Crecimiento / Actividad',
  EU_PMI_COMPOSITE: 'Crecimiento / Actividad',
  EU_RETAIL_SALES_YOY: 'Crecimiento / Actividad',
  EU_INDUSTRIAL_PRODUCTION_YOY: 'Crecimiento / Actividad',
  EU_CONSUMER_CONFIDENCE: 'Crecimiento / Actividad',
  EU_ZEW_SENTIMENT: 'Crecimiento / Actividad',

  // Mercado laboral
  PAYEMS: 'Mercado laboral',
  UNRATE: 'Mercado laboral',
  ICSA: 'Mercado laboral',
  JTSQUR: 'Mercado laboral',
  JTSJOL: 'Mercado laboral',
  JTSJOL_YOY: 'Mercado laboral',
  U6RATE: 'Mercado laboral',
  // European Labor Market
  EU_UNEMPLOYMENT: 'Mercado laboral',

  // Precios / Inflación
  PCEPI: 'Precios / Inflación',
  PCEPILFE: 'Precios / Inflación',
  CPIAUCSL: 'Precios / Inflación',
  CPILFESL: 'Precios / Inflación',
  PPIACO: 'Precios / Inflación',
  // European Inflation
  EU_CPI_YOY: 'Precios / Inflación',
  EU_CPI_CORE_YOY: 'Precios / Inflación',

  // Otros
  // FEDFUNDS pertenece en Otros (no duplicar en Financieros / Curva)
  FEDFUNDS: 'Otros',
  // European Monetary Policy
  EU_ECB_RATE: 'Otros',
}

export function categoryFor(key: string): Category {
  // Try exact match first
  if (CATEGORY_MAP[key]) {
    return CATEGORY_MAP[key]
  }
  // Try uppercase match (for keys like 'eu_cpi_yoy' -> 'EU_CPI_YOY')
  const upperKey = key.toUpperCase()
  if (CATEGORY_MAP[upperKey]) {
    return CATEGORY_MAP[upperKey]
  }
  // Try lowercase match (for keys like 'EU_CPI_YOY' -> 'eu_cpi_yoy')
  const lowerKey = key.toLowerCase()
  if (CATEGORY_MAP[lowerKey]) {
    return CATEGORY_MAP[lowerKey]
  }
  return 'Otros'
}


