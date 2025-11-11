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

  // Mercado laboral
  PAYEMS: 'Mercado laboral',
  UNRATE: 'Mercado laboral',
  ICSA: 'Mercado laboral',
  JTSQUR: 'Mercado laboral',
  JTSJOL: 'Mercado laboral',
  JTSJOL_YOY: 'Mercado laboral',
  U6RATE: 'Mercado laboral',

  // Precios / Inflación
  PCEPI: 'Precios / Inflación',
  PCEPILFE: 'Precios / Inflación',
  CPIAUCSL: 'Precios / Inflación',
  CPILFESL: 'Precios / Inflación',
  PPIACO: 'Precios / Inflación',

  // Otros
  // FEDFUNDS pertenece en Otros (no duplicar en Financieros / Curva)
  FEDFUNDS: 'Otros',
}

export function categoryFor(key: string): Category {
  return CATEGORY_MAP[key] ?? 'Otros'
}


