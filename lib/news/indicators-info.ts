/**
 * Information about macroeconomic indicators
 * Explicaciones detalladas de cada indicador y su impacto en trading
 */

export interface IndicatorInfo {
  key: string
  name: string
  category: string
  description: string
  whatItMeans: string
  tradingImpact: string
  institutionalReaction: string
  interpretation: {
    higher: string
    lower: string
    expected: string
  }
}

export const INDICATORS_INFO: Record<string, IndicatorInfo> = {
  CPIAUCSL: {
    key: 'CPIAUCSL',
    name: 'CPI YoY (Consumer Price Index)',
    category: 'Inflación',
    description: 'El Índice de Precios al Consumidor (CPI) mide los cambios en el precio de una canasta de bienes y servicios representativa del consumo de los hogares urbanos.',
    whatItMeans: 'El CPI es la medida más ampliamente seguida de inflación en Estados Unidos. Un aumento indica que los precios están subiendo, reduciendo el poder adquisitivo del consumidor.',
    tradingImpact: 'El CPI tiene un impacto MÁXIMO en los mercados. Un CPI más alto de lo esperado generalmente fortalece el dólar (expectativas de subida de tipos) y presiona a la baja acciones y bonos. Un CPI más bajo debilita el dólar y favorece activos de riesgo.',
    institutionalReaction: 'Los traders institucionales monitorean el CPI como el indicador más importante después del NFP. Un sorpresa positiva (mayor) puede causar movimientos de 50-100 pips en EUR/USD en minutos. Los fondos de pensiones ajustan sus carteras de bonos basándose en expectativas de inflación.',
    interpretation: {
      higher: 'Inflación más alta de lo esperado → FED más hawkish → USD fuerte, acciones/bonos bajistas',
      lower: 'Inflación más baja de lo esperado → FED más dovish → USD débil, acciones/bonos alcistas',
      expected: 'Sin sorpresas, el mercado mantiene su sesgo actual',
    },
  },
  CPILFESL: {
    key: 'CPILFESL',
    name: 'Core CPI YoY (Core Consumer Price Index)',
    category: 'Inflación',
    description: 'El Core CPI excluye alimentos y energía, que son volátiles. Mide la inflación subyacente, más persistente.',
    whatItMeans: 'El Core CPI es considerado más importante que el CPI general por la FED, ya que muestra la tendencia inflacionaria a largo plazo sin el ruido de commodities volátiles.',
    tradingImpact: 'El Core CPI tiene impacto ALTO. La FED lo usa como guía principal para política monetaria. Un Core CPI alto sostenido puede llevar a subidas de tipos más agresivas.',
    institutionalReaction: 'Los bancos centrales y fondos soberanos prestan más atención al Core CPI que al CPI general. Un Core CPI persistentemente alto puede cambiar completamente la narrativa de política monetaria.',
    interpretation: {
      higher: 'Inflación subyacente alta → FED mantendrá tipos altos → USD fuerte, presión bajista en activos de riesgo',
      lower: 'Inflación subyacente controlada → FED puede considerar recortes → USD débil, favorable para acciones',
      expected: 'Tendencia inflacionaria estable, sin cambios significativos en política',
    },
  },
  PCEPILFE: {
    key: 'PCEPILFE',
    name: 'Core PCE YoY (Personal Consumption Expenditures)',
    category: 'Inflación',
    description: 'El PCE es la medida de inflación PREFERIDA por la FED. Incluye una canasta más amplia y se actualiza con cambios en hábitos de consumo.',
    whatItMeans: 'La FED usa el PCE como su objetivo oficial de inflación (2%). Es más completo que el CPI porque incluye gastos de servicios médicos y otros que el CPI no captura bien.',
    tradingImpact: 'Impacto MUY ALTO. Aunque se publica después del CPI, el PCE es el que realmente importa para decisiones de la FED. Un PCE por encima de 2% mantiene presión hawkish.',
    institutionalReaction: 'Los traders institucionales ajustan sus expectativas de política monetaria basándose en el PCE. Un PCE persistentemente alto puede extender ciclos de subidas de tipos.',
    interpretation: {
      higher: 'PCE por encima de objetivo FED → Política restrictiva prolongada → USD fuerte, presión en mercados',
      lower: 'PCE acercándose a 2% → FED puede considerar recortes → USD débil, favorable para activos de riesgo',
      expected: 'Inflación en línea con objetivos, política monetaria estable',
    },
  },
  PPIACO: {
    key: 'PPIACO',
    name: 'PPI YoY (Producer Price Index)',
    category: 'Inflación',
    description: 'El Índice de Precios al Productor mide los cambios en los precios que reciben los productores por sus bienes y servicios.',
    whatItMeans: 'El PPI es un indicador adelantado de inflación. Si los productores suben precios, eventualmente se trasladan al consumidor (CPI).',
    tradingImpact: 'Impacto MEDIO-ALTO. El PPI se considera un predictor del CPI. Un PPI alto puede anticipar un CPI alto en meses siguientes.',
    institutionalReaction: 'Los traders institucionales usan el PPI para anticipar movimientos futuros del CPI. Un PPI sorprendentemente alto puede causar ajustes preventivos en carteras.',
    interpretation: {
      higher: 'Precios al productor subiendo → Presión inflacionaria futura → Expectativas de CPI alto → USD fuerte',
      lower: 'Precios al productor controlados → Menos presión inflacionaria → USD neutral a débil',
      expected: 'Sin señales de presión inflacionaria adicional',
    },
  },
  GDPC1: {
    key: 'GDPC1',
    name: 'GDP QoQ (Gross Domestic Product)',
    category: 'Crecimiento',
    description: 'El Producto Interno Bruto mide el valor total de todos los bienes y servicios producidos en la economía en un trimestre.',
    whatItMeans: 'El GDP es la medida más amplia de salud económica. Un GDP creciendo indica expansión económica, mientras que uno negativo indica recesión.',
    tradingImpact: 'Impacto MUY ALTO. El GDP es el indicador de crecimiento más importante. Un GDP fuerte favorece activos de riesgo (acciones, cripto) y puede fortalecer el dólar si viene con inflación controlada.',
    institutionalReaction: 'Los fondos de inversión ajustan sus asignaciones de activos basándose en el GDP. Un GDP fuerte puede llevar a rotación de bonos a acciones. Los traders de FX monitorean el GDP para evaluar la fortaleza relativa de economías.',
    interpretation: {
      higher: 'Crecimiento económico fuerte → Apetito por riesgo → Acciones y cripto alcistas, USD puede fortalecerse',
      lower: 'Crecimiento débil o negativo → Aversión al riesgo → Activos refugio (USD, oro), presión en acciones',
      expected: 'Crecimiento en línea con expectativas, sin cambios significativos en sesgo de mercado',
    },
  },
  INDPRO: {
    key: 'INDPRO',
    name: 'Industrial Production YoY',
    category: 'Crecimiento',
    description: 'Mide la producción física de fábricas, minas y servicios públicos. Es un proxy del PMI manufacturero.',
    whatItMeans: 'La producción industrial refleja la salud del sector manufacturero, que es un componente clave del GDP. Un aumento indica expansión económica.',
    tradingImpact: 'Impacto MEDIO-ALTO. La producción industrial es un indicador adelantado del GDP. Un aumento fuerte puede anticipar un GDP trimestral positivo.',
    institutionalReaction: 'Los traders institucionales usan la producción industrial para evaluar la fortaleza del sector manufacturero. Un dato fuerte puede favorecer acciones industriales y commodities.',
    interpretation: {
      higher: 'Producción industrial creciendo → Sector manufacturero fuerte → Favorable para crecimiento económico → Activos de riesgo alcistas',
      lower: 'Producción industrial débil → Sector manufacturero en dificultades → Señal de desaceleración → Activos refugio',
      expected: 'Sector manufacturero estable, sin cambios significativos',
    },
  },
  RSXFS: {
    key: 'RSXFS',
    name: 'Retail Sales YoY',
    category: 'Crecimiento',
    description: 'Mide las ventas de bienes y servicios por parte de minoristas. Es un proxy del PMI de servicios y refleja el consumo del consumidor.',
    whatItMeans: 'Las ventas minoristas representan aproximadamente 70% del GDP. Un aumento indica que los consumidores están gastando, lo cual impulsa el crecimiento económico.',
    tradingImpact: 'Impacto ALTO. Las ventas minoristas son un indicador clave de consumo, que es el motor principal de la economía estadounidense. Un dato fuerte favorece activos de riesgo.',
    institutionalReaction: 'Los fondos de inversión monitorean las ventas minoristas para evaluar la salud del consumidor. Un dato fuerte puede favorecer acciones de consumo discrecional y retail.',
    interpretation: {
      higher: 'Consumo fuerte → Crecimiento económico sólido → Favorable para acciones y activos de riesgo',
      lower: 'Consumo débil → Desaceleración económica → Presión en activos de riesgo, favorece refugios',
      expected: 'Consumo estable, sin cambios significativos en tendencia',
    },
  },
  PAYEMS: {
    key: 'PAYEMS',
    name: 'Nonfarm Payrolls (NFP)',
    category: 'Empleo',
    description: 'Mide el cambio mensual en el número de empleados en el sector no agrícola. Es el indicador de empleo más importante.',
    whatItMeans: 'El NFP es considerado el indicador económico más importante del mes. Un aumento fuerte indica un mercado laboral saludable, lo cual puede llevar a inflación y subidas de tipos.',
    tradingImpact: 'Impacto MÁXIMO. El NFP puede causar movimientos de 100+ pips en pares de divisas en minutos. Un NFP fuerte generalmente fortalece el dólar (expectativas de subida de tipos) y presiona acciones/bonos.',
    institutionalReaction: 'Los traders institucionales preparan estrategias específicas para el NFP. Los fondos de pensiones ajustan sus expectativas de política monetaria. Un NFP sorprendentemente fuerte puede cambiar completamente la narrativa del mercado.',
    interpretation: {
      higher: 'Mercado laboral fuerte → Presión inflacionaria → FED hawkish → USD fuerte, presión en activos de riesgo',
      lower: 'Mercado laboral débil → Menos presión inflacionaria → FED dovish → USD débil, favorable para acciones',
      expected: 'Mercado laboral en línea con expectativas, sin cambios significativos en política',
    },
  },
  UNRATE: {
    key: 'UNRATE',
    name: 'Unemployment Rate (U3)',
    category: 'Empleo',
    description: 'Mide el porcentaje de la fuerza laboral que está desempleada y buscando activamente trabajo.',
    whatItMeans: 'La tasa de desempleo es un indicador clave de salud del mercado laboral. Una tasa baja (por debajo de 4%) indica un mercado laboral ajustado, lo cual puede llevar a presiones salariales e inflación.',
    tradingImpact: 'Impacto ALTO. La tasa de desempleo es uno de los componentes de la Regla de Taylor que la FED usa para política monetaria. Una tasa muy baja puede mantener presión hawkish.',
    institutionalReaction: 'Los traders institucionales monitorean la tasa de desempleo junto con el NFP. Una tasa persistentemente baja puede extender ciclos de subidas de tipos.',
    interpretation: {
      higher: 'Desempleo subiendo → Mercado laboral debilitándose → FED puede considerar recortes → USD débil',
      lower: 'Desempleo bajando → Mercado laboral ajustado → Presión inflacionaria → FED hawkish → USD fuerte',
      expected: 'Mercado laboral estable, sin cambios significativos',
    },
  },
  ICSA: {
    key: 'ICSA',
    name: 'Initial Jobless Claims',
    category: 'Empleo',
    description: 'Mide el número de personas que solicitaron beneficios por desempleo por primera vez en la semana.',
    whatItMeans: 'Las solicitudes iniciales de desempleo son un indicador semanal y adelantado del mercado laboral. Un aumento puede anticipar un NFP débil.',
    tradingImpact: 'Impacto MEDIO. Aunque se publica semanalmente, un aumento sostenido en claims puede anticipar debilidad en el mercado laboral y cambiar expectativas de política monetaria.',
    institutionalReaction: 'Los traders institucionales monitorean las claims para anticipar el NFP. Un aumento sostenido puede llevar a ajustes preventivos en carteras.',
    interpretation: {
      higher: 'Claims subiendo → Mercado laboral debilitándose → Señal de desaceleración → Presión en USD',
      lower: 'Claims bajando → Mercado laboral fuerte → Favorable para USD y economía',
      expected: 'Mercado laboral estable, sin señales de cambio',
    },
  },
  FEDFUNDS: {
    key: 'FEDFUNDS',
    name: 'Federal Funds Rate',
    category: 'Política Monetaria',
    description: 'La tasa de interés a la cual los bancos se prestan fondos entre sí durante la noche. Es la herramienta principal de política monetaria de la FED.',
    whatItMeans: 'La tasa de fondos federales es la tasa de interés de referencia más importante. La FED la ajusta para controlar la inflación y el crecimiento económico.',
    tradingImpact: 'Impacto MÁXIMO. Los cambios en la tasa de fondos federales afectan directamente a todos los activos financieros. Una subida fortalece el dólar y presiona activos de riesgo.',
    institutionalReaction: 'Los traders institucionales ajustan todas sus posiciones basándose en cambios en la tasa de fondos federales. Los fondos de pensiones rebalancean carteras completas. Es el evento más importante del mercado.',
    interpretation: {
      higher: 'Tasa subiendo → Política restrictiva → USD fuerte, presión en activos de riesgo, bonos bajistas',
      lower: 'Tasa bajando → Política acomodaticia → USD débil, favorable para acciones y activos de riesgo',
      expected: 'Tasa estable, política monetaria sin cambios',
    },
  },
  T10Y2Y: {
    key: 'T10Y2Y',
    name: '10Y-2Y Treasury Spread',
    category: 'Política Monetaria',
    description: 'Mide la diferencia entre la tasa de bonos del Tesoro a 10 años y 2 años. Es un indicador de la curva de rendimientos.',
    whatItMeans: 'Un spread positivo (curva normal) indica expectativas de crecimiento. Un spread negativo (curva invertida) históricamente predice recesiones.',
    tradingImpact: 'Impacto ALTO. Una curva invertida es una señal de alerta para el mercado. Puede causar aversión al riesgo y fortalecer activos refugio.',
    institutionalReaction: 'Los traders institucionales monitorean la curva de rendimientos como predictor de recesión. Una inversión sostenida puede llevar a estrategias defensivas.',
    interpretation: {
      higher: 'Spread ampliándose → Curva normal → Expectativas de crecimiento → Favorable para activos de riesgo',
      lower: 'Spread estrechándose o invirtiéndose → Señal de recesión → Aversión al riesgo → Activos refugio',
      expected: 'Curva estable, sin señales de inversión',
    },
  },
  VIXCLS: {
    key: 'VIXCLS',
    name: 'VIX (Volatility Index)',
    category: 'Riesgo',
    description: 'Mide la volatilidad esperada del S&P 500 en los próximos 30 días. También conocido como "índice del miedo".',
    whatItMeans: 'Un VIX alto (>25) indica miedo y aversión al riesgo en el mercado. Un VIX bajo (<15) indica confianza y apetito por riesgo.',
    tradingImpact: 'Impacto ALTO como modulador. El VIX no causa movimientos directos, pero amplifica o reduce el impacto de otros indicadores. Un VIX alto puede hacer que cualquier noticia negativa tenga mayor impacto.',
    institutionalReaction: 'Los traders institucionales usan el VIX para ajustar el tamaño de sus posiciones. Un VIX alto puede llevar a reducción de exposición y estrategias defensivas.',
    interpretation: {
      higher: 'VIX alto → Miedo en el mercado → Aversión al riesgo → Activos refugio (USD, oro), presión en acciones',
      lower: 'VIX bajo → Confianza en el mercado → Apetito por riesgo → Favorable para acciones y activos de riesgo',
      expected: 'Volatilidad normal, condiciones de mercado estables',
    },
  },
}

/**
 * Get indicator info by key or theme
 */
export function getIndicatorInfo(keyOrTheme: string | null | undefined): IndicatorInfo | null {
  if (!keyOrTheme) return null

  // Try direct key match first
  if (INDICATORS_INFO[keyOrTheme]) {
    return INDICATORS_INFO[keyOrTheme]
  }

  // Try theme match (case insensitive)
  const themeLower = keyOrTheme.toLowerCase().trim()
  
  // Try common aliases first
  const aliases: Record<string, string> = {
    'cpi': 'CPIAUCSL',
    'consumer price index': 'CPIAUCSL',
    'core cpi': 'CPILFESL',
    'pce': 'PCEPILFE',
    'personal consumption expenditures': 'PCEPILFE',
    'core pce': 'PCEPILFE',
    'ppi': 'PPIACO',
    'producer price index': 'PPIACO',
    'gdp': 'GDPC1',
    'gross domestic product': 'GDPC1',
    'nfp': 'PAYEMS',
    'nonfarm payrolls': 'PAYEMS',
    'payrolls': 'PAYEMS',
    'employment': 'PAYEMS',
    'unemployment': 'UNRATE',
    'unemployment rate': 'UNRATE',
    'claims': 'ICSA',
    'jobless claims': 'ICSA',
    'initial claims': 'ICSA',
    'fed funds': 'FEDFUNDS',
    'federal funds': 'FEDFUNDS',
    'interest rate': 'FEDFUNDS',
    'vix': 'VIXCLS',
    'volatility': 'VIXCLS',
    'volatility index': 'VIXCLS',
    'industrial production': 'INDPRO',
    'retail sales': 'RSXFS',
    'inflation': 'CPIAUCSL',
    'inflacion': 'CPIAUCSL',
  }

  // Check aliases
  for (const [alias, key] of Object.entries(aliases)) {
    if (themeLower.includes(alias) || alias.includes(themeLower)) {
      return INDICATORS_INFO[key]
    }
  }

  // Try name match
  for (const [key, info] of Object.entries(INDICATORS_INFO)) {
    const nameLower = info.name.toLowerCase()
    if (nameLower.includes(themeLower) || themeLower.includes(nameLower)) {
      return info
    }
    // Try key match
    if (info.key.toLowerCase() === themeLower || themeLower.includes(info.key.toLowerCase())) {
      return info
    }
  }

  return null
}

/**
 * Get all indicators by category
 */
export function getIndicatorsByCategory(): Record<string, IndicatorInfo[]> {
  const byCategory: Record<string, IndicatorInfo[]> = {}
  
  for (const info of Object.values(INDICATORS_INFO)) {
    if (!byCategory[info.category]) {
      byCategory[info.category] = []
    }
    byCategory[info.category].push(info)
  }
  
  return byCategory
}

