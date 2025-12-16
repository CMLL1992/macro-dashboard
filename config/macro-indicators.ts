/**
 * Configuración centralizada de indicadores macro
 * Define cómo obtener, transformar y formatear cada indicador
 * para que coincida con lo que ve un trader en calendarios económicos
 */

export type Unit = 'percent' | 'index' | 'level' | 'thousands' | 'millions'
export type Transform = 'none' | 'yoy' | 'qoq' | 'mom' | 'delta' | 'sma4'
export type PeriodType = 'monthly' | 'quarterly' | 'weekly' | 'daily' | 'annual'
export type Source = 'FRED' | 'TRADING_ECONOMICS' | 'ECB' | 'MANUAL' | 'OTHER'

export interface MacroIndicatorConfig {
  id: string                    // Identificador interno (ej: 'jolts_openings')
  label: string                 // Nombre que se muestra (ej: 'Ofertas de empleo JOLTS')
  source: Source                // Fuente de datos
  fredSeriesId?: string          // ID de serie FRED (ej: 'JTSJOL')
  fredTransform?: string         // Transformación FRED (ej: 'pc1' para YoY, 'pca' para QoQ anualizado, 'lin' para nivel)
  externalId?: string           // ID externo para TradingEconomics/Investing (ej: 'Euro Area GDP QoQ')
  transform: Transform           // Transformación a aplicar en backend (si FRED no la aplica)
  unit: Unit                    // Unidad de visualización
  scale: number                 // Multiplicador para convertir de fuente → display (ej: 1/1000 para miles→millions, 0.1 si viene 10x)
  decimals: number              // Número de decimales a mostrar
  periodType: PeriodType        // Tipo de periodo
  isOfficialYoY: boolean        // true solo si el indicador se publica oficialmente como YoY
  isOfficialQoQ?: boolean        // true solo si el indicador se publica oficialmente como QoQ
  formatValue?: (value: number) => string  // Función opcional para formatear el valor
}

/**
 * Configuración de todos los indicadores macro
 */
export const MACRO_INDICATORS_CONFIG: Record<string, MacroIndicatorConfig> = {
  // ========== USA - Mercado Laboral ==========
  jolts_openings: {
    id: 'jolts_openings',
    label: 'Ofertas de empleo JOLTS',
    source: 'FRED',
    fredSeriesId: 'JTSJOL',
    transform: 'none',           // Nivel, NO YoY
    unit: 'millions',
    scale: 1 / 1000,            // FRED da miles → mostramos millones
    decimals: 3,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  unrate: {
    id: 'unrate',
    label: 'Tasa de Desempleo (U3)',
    source: 'FRED',
    fredSeriesId: 'UNRATE',
    transform: 'none',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  payems_delta: {
    id: 'payems_delta',
    label: 'Nóminas No Agrícolas (NFP Δ)',
    source: 'FRED',
    fredSeriesId: 'PAYEMS',
    transform: 'delta',          // Cambio mensual
    unit: 'thousands',
    scale: 1,                    // FRED ya da en miles
    decimals: 0,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  claims_4w: {
    id: 'claims_4w',
    label: 'Solicitudes Iniciales de Subsidio (Media 4 semanas)',
    source: 'FRED',
    fredSeriesId: 'ICSA',
    transform: 'sma4',           // Media móvil de 4 semanas
    unit: 'thousands',
    scale: 1,                    // FRED ya da en miles
    decimals: 2,
    periodType: 'weekly',
    isOfficialYoY: false,
  },
  
  // ========== USA - Inflación (Oficialmente YoY) ==========
  cpi_yoy: {
    id: 'cpi_yoy',
    label: 'Inflación CPI (YoY)',
    source: 'FRED',
    fredSeriesId: 'CPIAUCSL',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  corecpi_yoy: {
    id: 'corecpi_yoy',
    label: 'Inflación Core CPI (YoY)',
    source: 'FRED',
    fredSeriesId: 'CPILFESL',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  pce_yoy: {
    id: 'pce_yoy',
    label: 'Inflación PCE (YoY)',
    source: 'FRED',
    fredSeriesId: 'PCEPI',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  corepce_yoy: {
    id: 'corepce_yoy',
    label: 'Inflación Core PCE (YoY)',
    source: 'FRED',
    fredSeriesId: 'PCEPILFE',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  ppi_yoy: {
    id: 'ppi_yoy',
    label: 'Índice de Precios al Productor (PPI YoY)',
    source: 'FRED',
    fredSeriesId: 'PPIACO',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  // ========== USA - Crecimiento ==========
  gdp_yoy: {
    id: 'gdp_yoy',
    label: 'PIB Interanual (GDP YoY)',
    source: 'FRED',
    fredSeriesId: 'GDPC1',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'quarterly',
    isOfficialYoY: true,
  },
  
  gdp_qoq: {
    id: 'gdp_qoq',
    label: 'PIB Trimestral (GDP QoQ Anualizado)',
    source: 'FRED',
    fredSeriesId: 'GDPC1',
    transform: 'qoq',
    unit: 'percent',
    scale: 1,
    decimals: 1,
    periodType: 'quarterly',
    isOfficialYoY: false,
  },
  
  indpro_yoy: {
    id: 'indpro_yoy',
    label: 'Producción Industrial (YoY)',
    source: 'FRED',
    fredSeriesId: 'INDPRO',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  retail_yoy: {
    id: 'retail_yoy',
    label: 'Ventas Minoristas (YoY)',
    source: 'FRED',
    fredSeriesId: 'RSAFS', // Retail and Food Services Sales (Total, nivel)
    // fredTransform removed: FRED units=pc1 may not be supported for RSAFS
    // Instead, ingest raw level and calculate YoY in read-macro.ts using yoy() function
    transform: 'yoy',      // Calculate YoY from raw level data
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  // ========== USA - Encuestas / PMI ==========
  pmi_mfg: {
    id: 'pmi_mfg',
    label: 'PMI manufacturero (ISM)',
    source: 'FRED',
    fredSeriesId: 'USPMI',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  // ========== USA - Política Monetaria ==========
  fedfunds: {
    id: 'fedfunds',
    label: 'Tasa Efectiva de Fondos Federales',
    source: 'FRED',
    fredSeriesId: 'FEDFUNDS',
    transform: 'none',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  t10y2y: {
    id: 't10y2y',
    label: 'Curva 10Y–2Y (spread %)',
    source: 'FRED',
    fredSeriesId: 'T10Y2Y',
    transform: 'none',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'daily',
    isOfficialYoY: false,
  },
  
  // ========== USA - Otros ==========
  vix: {
    id: 'vix',
    label: 'Índice de Volatilidad VIX',
    source: 'FRED',
    fredSeriesId: 'VIXCLS',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 2,
    periodType: 'daily',
    isOfficialYoY: false,
  },
  
  // ========== Eurozona - Usando TradingEconomics/ECB ==========
  eu_gdp_qoq: {
    id: 'eu_gdp_qoq',
    label: 'PIB Eurozona (QoQ)',
    source: 'ECB', // Viene de ECB como nivel, se calcula QoQ en read-macro.ts
    transform: 'qoq', // Calcular QoQ desde nivel (QoQ simple, no anualizado)
    unit: 'percent',
    scale: 1, // El resultado de la transformación ya está en %
    decimals: 2, // Mostrar +0.1%, +0.2%
    periodType: 'quarterly',
    isOfficialYoY: false,
    isOfficialQoQ: true,
  },
  
  eu_gdp_yoy: {
    id: 'eu_gdp_yoy',
    label: 'PIB Eurozona (YoY)',
    source: 'ECB', // Viene de ECB como nivel, se calcula YoY en read-macro.ts
    transform: 'yoy', // Calcular YoY desde nivel
    unit: 'percent',
    scale: 1, // El resultado de la transformación ya está en %
    decimals: 2,
    periodType: 'quarterly',
    isOfficialYoY: true,
  },
  
  eu_cpi_yoy: {
    id: 'eu_cpi_yoy',
    label: 'Inflación Eurozona (CPI YoY)',
    source: 'OTHER',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  eu_cpi_core_yoy: {
    id: 'eu_cpi_core_yoy',
    label: 'Inflación Core Eurozona (Core CPI YoY)',
    source: 'OTHER',
    transform: 'yoy',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  eu_unemployment: {
    id: 'eu_unemployment',
    label: 'Tasa de Desempleo Eurozona',
    source: 'OTHER',
    transform: 'none',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_pmi_manufacturing: {
    id: 'eu_pmi_manufacturing',
    label: 'PMI Manufacturero Eurozona',
    source: 'OTHER',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_pmi_services: {
    id: 'eu_pmi_services',
    label: 'PMI Servicios Eurozona',
    source: 'OTHER',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_pmi_composite: {
    id: 'eu_pmi_composite',
    label: 'PMI Compuesto Eurozona',
    source: 'TRADING_ECONOMICS',
    externalId: 'Euro Area PMI Composite',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_ecb_rate: {
    id: 'eu_ecb_rate',
    label: 'Tasa de Interés BCE (Main Refinancing Rate)',
    source: 'OTHER',
    transform: 'none',
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_retail_sales_yoy: {
    id: 'eu_retail_sales_yoy',
    label: 'Ventas Minoristas Eurozona (YoY)',
    source: 'TRADING_ECONOMICS',
    externalId: 'Euro Area Retail Sales YoY',
    transform: 'yoy', // Calculate YoY from index values (Eurostat)
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  eu_retail_sales_mom: {
    id: 'eu_retail_sales_mom',
    label: 'Ventas Minoristas Eurozona (MoM)',
    source: 'TRADING_ECONOMICS',
    externalId: 'Euro Area Retail Sales MoM',
    transform: 'mom', // Calculate MoM from index values (Eurostat)
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_industrial_production_yoy: {
    id: 'eu_industrial_production_yoy',
    label: 'Producción Industrial Eurozona (YoY)',
    source: 'TRADING_ECONOMICS',
    externalId: 'Euro Area Industrial Production YoY',
    transform: 'none', // TradingEconomics ya devuelve YoY
    unit: 'percent',
    scale: 1,
    decimals: 2,
    periodType: 'monthly',
    isOfficialYoY: true,
  },
  
  eu_consumer_confidence: {
    id: 'eu_consumer_confidence',
    label: 'Confianza del Consumidor Eurozona',
    source: 'OTHER',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
  
  eu_zew_sentiment: {
    id: 'eu_zew_sentiment',
    label: 'ZEW Economic Sentiment Eurozona',
    source: 'OTHER',
    transform: 'none',
    unit: 'index',
    scale: 1,
    decimals: 1,
    periodType: 'monthly',
    isOfficialYoY: false,
  },
}

/**
 * Obtener configuración de un indicador por su ID
 */
export function getIndicatorConfig(id: string): MacroIndicatorConfig | undefined {
  return MACRO_INDICATORS_CONFIG[id]
}

/**
 * Formatear valor según la configuración del indicador
 */
export function formatIndicatorValue(value: number, config: MacroIndicatorConfig): string {
  const scaled = value * config.scale
  const rounded = Number(scaled.toFixed(config.decimals))
  
  switch (config.unit) {
    case 'percent':
      return `${rounded}%`
    case 'millions':
      return `${rounded}M`
    case 'thousands':
      return `${rounded}K`
    case 'index':
      return rounded.toString()
    case 'level':
      return rounded.toString()
    default:
      return rounded.toString()
  }
}

/**
 * Formatear fecha según el tipo de periodo
 */
export function formatIndicatorDate(dateStr: string, periodType: PeriodType): string {
  const date = new Date(dateStr)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  switch (periodType) {
    case 'monthly':
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3) + 1
      return `Q${quarter} ${date.getFullYear()}`
    case 'weekly':
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    case 'daily':
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    default:
      return date.toLocaleDateString('es-ES')
  }
}

