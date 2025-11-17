import type { Posture } from './posture'

export type Scenario = { id: string; title: string; severity: 'alta' | 'media' | 'baja'; why: string; actionHint: string }

export function detectScenarios(items: any[], regime: string): Scenario[] {
  const get = (k: string) => items.find((i: any) => i.key === k)
  const p = (k: string) => get(k)?.posture as Posture | undefined
  const v = (k: string) => get(k)?.value as number | undefined
  const out: Scenario[] = []

  // 1) Estanflación: Inflación Hawkish + Crecimiento Dovish
  const inflHawk = ['PCEPI', 'PCEPILFE', 'CPIAUCSL', 'CPILFESL'].map(k => p(k)).some(pp => pp === 'Hawkish')
  const growthDov = ['GDPC1', 'INDPRO', 'RSXFS', 'USSLIND'].map(k => p(k)).some(pp => pp === 'Dovish')
  if (inflHawk && growthDov)
    out.push({
      id: 'estanflacion',
      title: 'Riesgo de estanflación',
      severity: 'alta',
      why: 'Inflación alta coincidiendo con debilidad en crecimiento',
      actionHint: 'Evitar cíclicos; favorecer USD/defensivos, oro selectivo',
    })

  // 2) Expansión limpia: Inflación Dovish + Crecimiento Hawkish
  const inflDov = ['PCEPI', 'PCEPILFE', 'CPIAUCSL', 'CPILFESL'].map(k => p(k)).some(pp => pp === 'Dovish')
  const growthHawk = ['GDPC1', 'INDPRO', 'RSXFS', 'USSLIND'].map(k => p(k)).some(pp => pp === 'Hawkish')
  if (inflDov && growthHawk)
    out.push({
      id: 'expansion_limpia',
      title: 'Expansión con inflación controlada',
      severity: 'media',
      why: 'Crecimiento sólido con desinflación',
      actionHint: 'Favorecer riesgo (SPX/NDX), EUR/GBP/AUD, cripto',
    })

  // 3) Empleo se enfría: Δ NFP bajo + Claims > 300k + U3 subiendo
  const nfp = v('PAYEMS')
  const claims = v('ICSA')
  const u3 = v('UNRATE')
  if ((nfp != null && nfp < 100) || (claims != null && claims > 300000) || (u3 != null && u3 > 4.5)) {
    out.push({
      id: 'empleo_enfriando',
      title: 'Empleo enfriándose',
      severity: 'media',
      why: 'NFP bajo / Claims altos / U3 alto',
      actionHint: 'USD tendería a debilitarse a medio plazo; vigilar cortes de tipos',
    })
  }

  // 4) USD fuerte amplio: DXY proxy en Hawkish + curvas Hawkish
  const dxyHawk = p('DTWEXBGS') === 'Hawkish'
  const curveHawk = p('T10Y2Y') === 'Hawkish' && p('T10Y3M') === 'Hawkish'
  if (dxyHawk && curveHawk)
    out.push({
      id: 'usd_fuerte',
      title: 'USD ampliamente fuerte',
      severity: 'media',
      why: 'Dólar amplio + curvas sugieren tipos altos',
      actionHint: 'Vender EUR/GBP/AUD; preferir USDJPY/USDCAD',
    })

  // 5) Riesgo macro (NFCI)
  const nfci = v('NFCI')
  if (nfci != null && nfci > 0.3)
    out.push({
      id: 'condiciones_financieras_tensas',
      title: 'Condiciones financieras tensas',
      severity: 'alta',
      why: 'NFCI elevado indica restricciones de liquidez',
      actionHint: 'Reducir exposición a beta; priorizar calidad y USD/JPY',
    })

  // Regla general por régimen
  if (regime === 'RISK OFF')
    out.push({
      id: 'riesgo_off',
      title: 'Entorno Risk-OFF',
      severity: 'alta',
      why: 'Score ponderado por debajo del umbral',
      actionHint: 'Coberturas, largos en USD/JPY, evitar cíclicos',
    })

  return out
}
