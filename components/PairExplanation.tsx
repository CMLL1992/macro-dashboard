interface PairExplanationProps {
  symbol: string
}

const PAIR_EXPLANATIONS: Record<string, {
  icon: string
  name: string
  content: {
    what: string
    interpretation: string
    correlation: string
    news: string
  }
}> = {
  'EURUSD': {
    icon: '🇪🇺💲',
    name: 'EURUSD',
    content: {
      what: 'Esta sección muestra la dirección macro del par EUR/USD frente al USD, combinando la fuerza macro del euro y del dólar, las correlaciones históricas con el DXY, y el impacto de las últimas noticias económicas de ambas economías.',
      interpretation: 'Si el sesgo es Bajista (favor USD) → la macro actual favorece depreciación del EUR frente al USD. Si es Alcista (favor EUR) → la macro favorece apreciación del EUR. Si es Neutral → las señales son mixtas, se prioriza análisis técnico y táctico.',
      correlation: 'EURUSD tiene correlación fuerte y negativa con DXY. Cuando la correlación es consistente entre ventanas (12m y 3m), los sesgos son más fiables. Si la correlación está rota o invertida → cautela en la interpretación, puede haber factores específicos del EUR dominando sobre el contexto USD.',
      news: 'Noticias USD (NFP, CPI, Fed decisions) tienen impacto directo en la dirección del par. Noticias EUR (datos Eurozona, decisiones BCE) son segundo factor, pueden contrarrestar o acentuar la presión del USD. Ambos drivers son importantes para este par.',
    },
  },
  'XAUUSD': {
    icon: '🟡💲',
    name: 'XAUUSD (Oro)',
    content: {
      what: 'Esta sección muestra la dirección macro del oro (XAU/USD) frente al USD, combinando condiciones de tipos reales, fortaleza del dólar, apetito por riesgo, y el rol del oro como activo refugio o cobertura contra inflación.',
      interpretation: 'Si el sesgo es Bajista (favor USD) → condiciones macro de tipos altos y USD fuerte presionan el oro a la baja. Si es Alcista (favor XAU) → el oro actúa como refugio (Risk OFF) o el USD se debilita, favoreciendo al oro. Si es Neutral → señales mixtas entre refugio y presión de tipos.',
      correlation: 'El oro tiende a moverse inverso al USD y a tipos reales. Correlación negativa fuerte con DXY es típica. Si la correlación está rota → puede haber flujos de refugio específicos (geopolítica, crisis) o cambios en expectativas de inflación que dominan sobre el USD.',
      news: 'Noticias USD y política monetaria (Fed decisions, CPI, NFP) afectan directamente al oro a través de tipos y fortaleza del dólar. Datos de riesgo global (VIX, eventos geopolíticos) también pueden fortalecer el oro como refugio independientemente del USD.',
    },
  },
  'GBPUSD': {
    icon: '🇬🇧💲',
    name: 'GBPUSD',
    content: {
      what: 'Esta sección muestra la dirección macro del par GBP/USD frente al USD, combinando la fuerza macro de la libra esterlina y del dólar, las correlaciones históricas con el DXY, y el impacto de las últimas noticias económicas del Reino Unido y Estados Unidos.',
      interpretation: 'Si el sesgo es Bajista (favor USD) → la macro actual favorece depreciación del GBP frente al USD. Si es Alcista (favor GBP) → la macro favorece apreciación del GBP. Si es Neutral → las señales son mixtas, factores específicos del Reino Unido pueden estar dominando.',
      correlation: 'GBPUSD tiene correlación moderada a fuerte y negativa con DXY. Cuando la correlación es consistente, los sesgos son más fiables. Si la correlación está rota → puede haber factores específicos del Reino Unido (BoE, datos UK, Brexit) dominando sobre el contexto USD.',
      news: 'Noticias USD (NFP, CPI, Fed decisions) tienen impacto directo. Noticias GBP (datos UK, decisiones BoE, empleo UK) son segundo factor importante, pueden contrarrestar o acentuar presión del USD. El Reino Unido tiene dinámicas propias que pueden dominar.',
    },
  },
  'USDJPY': {
    icon: '💲🇯🇵',
    name: 'USDJPY',
    content: {
      what: 'Esta sección muestra la dirección macro del par USD/JPY, combinando la fuerza macro del dólar y del yen japonés, las correlaciones históricas con el DXY, y el impacto de las políticas monetarias de la Fed y el BoJ.',
      interpretation: 'Si el sesgo es Alcista (favor USD) → la macro favorece apreciación del USD frente al JPY. Si es Bajista (favor JPY) → la macro favorece apreciación del JPY (refugio) o debilidad del USD. Si es Neutral → señales mixtas entre diferencial de tipos y refugio.',
      correlation: 'USDJPY tiene correlación positiva con DXY (cuando USD sube, el par sube). Correlación fuerte y consistente indica que el diferencial de tipos es el driver principal. Si la correlación está rota → puede haber flujos de refugio hacia JPY o cambios en política del BoJ dominando.',
      news: 'Noticias USD (Fed decisions, CPI, NFP) tienen impacto directo. Noticias JPY (BoJ decisions, datos Japón) son segundo factor, pero el diferencial de tipos suele dominar. En Risk OFF, el JPY puede fortalecerse como refugio independientemente del USD.',
    },
  },
  'AUDUSD': {
    icon: '🇦🇺💲',
    name: 'AUDUSD',
    content: {
      what: 'Esta sección muestra la dirección macro del par AUD/USD, combinando la fuerza macro del dólar australiano y del dólar estadounidense, las correlaciones históricas con el DXY, y el impacto de datos de commodities y política monetaria.',
      interpretation: 'Si el sesgo es Bajista (favor USD) → la macro favorece depreciación del AUD frente al USD. Si es Alcista (favor AUD) → la macro favorece apreciación del AUD (commodities fuertes, Risk ON). Si es Neutral → señales mixtas entre commodities y fortaleza del USD.',
      correlation: 'AUDUSD tiene correlación negativa con DXY y positiva con commodities y Risk ON. Correlación fuerte indica que el apetito por riesgo y commodities dominan. Si la correlación está rota → puede haber factores específicos de Australia (RBA, datos AU) dominando.',
      news: 'Noticias USD (Fed decisions, CPI) tienen impacto directo. Noticias AUD (RBA decisions, empleo AU, datos de commodities) son segundo factor importante. Datos de China también pueden afectar al AUD por su relación comercial.',
    },
  },
  'USDCAD': {
    icon: '💲🇨🇦',
    name: 'USDCAD',
    content: {
      what: 'Esta sección muestra la dirección macro del par USD/CAD, combinando la fuerza macro del dólar estadounidense y del dólar canadiense, las correlaciones históricas con el DXY, y el impacto de datos de petróleo y política monetaria.',
      interpretation: 'Si el sesgo es Alcista (favor USD) → la macro favorece apreciación del USD frente al CAD. Si es Bajista (favor CAD) → la macro favorece apreciación del CAD (petróleo fuerte, BoC hawkish). Si es Neutral → señales mixtas entre petróleo y fortaleza del USD.',
      correlation: 'USDCAD tiene correlación moderada con DXY y negativa con petróleo. Correlación fuerte indica que el petróleo y diferencial de tipos dominan. Si la correlación está rota → puede haber factores específicos de Canadá (BoC, datos CA) dominando sobre el contexto USD.',
      news: 'Noticias USD (Fed decisions, CPI) tienen impacto directo. Noticias CAD (BoC decisions, datos Canadá, inventarios de petróleo) son segundo factor importante. El precio del petróleo es un driver clave para el CAD.',
    },
  },
  'NZDUSD': {
    icon: '🇳🇿💲',
    name: 'NZDUSD',
    content: {
      what: 'Esta sección muestra la dirección macro del par NZD/USD, combinando la fuerza macro del dólar neozelandés y del dólar estadounidense, las correlaciones históricas con el DXY, y el impacto de datos de commodities y política monetaria.',
      interpretation: 'Si el sesgo es Bajista (favor USD) → la macro favorece depreciación del NZD frente al USD. Si es Alcista (favor NZD) → la macro favorece apreciación del NZD (commodities fuertes, Risk ON). Si es Neutral → señales mixtas entre commodities y fortaleza del USD.',
      correlation: 'NZDUSD tiene correlación negativa con DXY y positiva con commodities y Risk ON. Correlación fuerte indica que el apetito por riesgo y commodities dominan. Si la correlación está rota → puede haber factores específicos de Nueva Zelanda (RBNZ, datos NZ) dominando.',
      news: 'Noticias USD (Fed decisions, CPI) tienen impacto directo. Noticias NZD (RBNZ decisions, datos Nueva Zelanda, precios de commodities) son segundo factor importante. Datos de China también pueden afectar al NZD por su relación comercial.',
    },
  },
  'USDCHF': {
    icon: '💲🇨🇭',
    name: 'USDCHF',
    content: {
      what: 'Esta sección muestra la dirección macro del par USD/CHF, combinando la fuerza macro del dólar estadounidense y del franco suizo, las correlaciones históricas con el DXY, y el impacto de políticas monetarias y flujos de refugio.',
      interpretation: 'Si el sesgo es Alcista (favor USD) → la macro favorece apreciación del USD frente al CHF. Si es Bajista (favor CHF) → la macro favorece apreciación del CHF como refugio o debilidad del USD. Si es Neutral → señales mixtas entre diferencial de tipos y refugio.',
      correlation: 'USDCHF tiene correlación positiva con DXY pero el CHF también actúa como refugio. Correlación fuerte indica que el diferencial de tipos domina. Si la correlación está rota → puede haber flujos de refugio hacia CHF (geopolítica, crisis) dominando sobre el contexto USD.',
      news: 'Noticias USD (Fed decisions, CPI) tienen impacto directo. Noticias CHF (SNB decisions, datos Suiza) son segundo factor, pero el CHF suele moverse más por flujos de refugio que por datos locales. Eventos geopolíticos pueden fortalecer el CHF independientemente del USD.',
    },
  },
}

export default function PairExplanation({ symbol }: PairExplanationProps) {
  // Normalizar el símbolo
  const normalizedSymbol = symbol.replace('/', '').toUpperCase()
  
  // Buscar explicación exacta o por coincidencia parcial
  let explanation = PAIR_EXPLANATIONS[normalizedSymbol]
  
  if (!explanation) {
    // Intentar coincidencias parciales
    if (normalizedSymbol.includes('EUR') && normalizedSymbol.includes('USD')) {
      explanation = PAIR_EXPLANATIONS['EURUSD']
    } else if (normalizedSymbol.includes('XAU') || normalizedSymbol.includes('GOLD')) {
      explanation = PAIR_EXPLANATIONS['XAUUSD']
    } else if (normalizedSymbol.includes('GBP') && normalizedSymbol.includes('USD')) {
      explanation = PAIR_EXPLANATIONS['GBPUSD']
    } else if (normalizedSymbol.includes('USD') && normalizedSymbol.includes('JPY')) {
      explanation = PAIR_EXPLANATIONS['USDJPY']
    } else if (normalizedSymbol.includes('AUD') && normalizedSymbol.includes('USD')) {
      explanation = PAIR_EXPLANATIONS['AUDUSD']
    } else if (normalizedSymbol.includes('USD') && normalizedSymbol.includes('CAD')) {
      explanation = PAIR_EXPLANATIONS['USDCAD']
    } else if (normalizedSymbol.includes('NZD') && normalizedSymbol.includes('USD')) {
      explanation = PAIR_EXPLANATIONS['NZDUSD']
    } else if (normalizedSymbol.includes('USD') && normalizedSymbol.includes('CHF')) {
      explanation = PAIR_EXPLANATIONS['USDCHF']
    }
  }
  
  // Si no hay explicación específica, usar una genérica
  if (!explanation) {
    return (
      <div className="rounded-lg border p-4 bg-slate-900/50 space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          💱 ¿Cómo leer la información de {symbol}?
        </h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div>
            <h4 className="font-medium text-slate-200 mb-1">1) Qué estás viendo</h4>
            <p>
              Esta sección muestra la dirección macro del activo frente al USD, combinando la fuerza macro de cada moneda,
              correlaciones con el dólar, y el impacto de las últimas noticias económicas.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-1">2) Cómo se interpreta</h4>
            <p>
              Si el sesgo es Alcista → la macro favorece movimientos alcistas. Si es Bajista → la macro favorece movimientos bajistas.
              Si es Neutral → las señales son mixtas, se prioriza análisis técnico.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-1">3) Cómo influye la correlación</h4>
            <p>
              La correlación con DXY muestra cómo se relaciona históricamente este activo con el dólar. Correlación fuerte y consistente
              hace los sesgos más fiables. Si está rota → cautela en la interpretación.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-1">4) Rol de las noticias macro</h4>
            <p>
              Noticias USD tienen impacto directo. Noticias de la otra moneda son segundo factor, pueden contrarrestar o acentuar
              la presión del USD.
            </p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded p-2">
            <h4 className="font-medium text-yellow-200 mb-1">5) Recordatorio importante</h4>
            <p className="text-yellow-100">
              🔒 El dashboard no genera señales de entrada ni salida. Tú decides la gestión operativa (entradas, SL, TP…)
              con tu análisis técnico.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-lg border p-4 bg-slate-900/50 space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        {explanation.icon} ¿Cómo leer la información de {explanation.name}?
      </h3>
      <div className="space-y-3 text-sm text-slate-300">
        <div>
          <h4 className="font-medium text-slate-200 mb-1">1) Qué estás viendo</h4>
          <p>{explanation.content.what}</p>
        </div>
        <div>
          <h4 className="font-medium text-slate-200 mb-1">2) Cómo se interpreta para este par</h4>
          <p>{explanation.content.interpretation}</p>
        </div>
        <div>
          <h4 className="font-medium text-slate-200 mb-1">3) Cómo influye la correlación</h4>
          <p>{explanation.content.correlation}</p>
        </div>
        <div>
          <h4 className="font-medium text-slate-200 mb-1">4) Rol de las noticias macro</h4>
          <p>{explanation.content.news}</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded p-2">
          <h4 className="font-medium text-yellow-200 mb-1">5) Recordatorio importante</h4>
          <p className="text-yellow-100">
            🔒 El dashboard no genera señales de entrada ni salida. Tú decides la gestión operativa (entradas, SL, TP…)
            con tu análisis técnico.
          </p>
        </div>
      </div>
    </div>
  )
}
