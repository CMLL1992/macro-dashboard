/**
 * Narrative generator for Telegram notifications
 * Transforms bias data into readable narratives
 */

type BiasRow = {
  par: string
  tactico?: string
  accion: string
  confianza?: string
  corr12m?: number | null
  corr3m?: number | null
  motivo?: string
}

type NarrativeItem = {
  pair: string
  narrative: string
}

export function generateNarratives(
  biasRows: BiasRow[],
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
): NarrativeItem[] {
  return biasRows.map((item) => {
    const { par, tactico, accion, confianza, corr12m, corr3m } = item

    const narrative = `
*${par}*

Tendencia: ${tactico || 'N/A'}
Acción recomendada: ${accion}
Confianza: ${confianza || 'N/A'}
Correlación 12m: ${corr12m != null ? corr12m.toFixed(2) : 'N/A'}
Correlación 3m: ${corr3m != null ? corr3m.toFixed(2) : 'N/A'}
USD: ${usdBias}

Interpretación:
${interpret(par, confianza, corr12m, corr3m, usdBias)}
`.trim()

    return { pair: par, narrative }
  })
}

function interpret(
  pair: string,
  confidence: string | undefined,
  corr12m: number | null | undefined,
  corr3m: number | null | undefined,
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
): string {
  if (corr12m == null && corr3m == null) {
    return `Relación débil con el USD. Priorizar price action y drivers propios.`
  }

  const corr = corr12m ?? corr3m ?? 0

  if (corr < -0.1) {
    // Relación inversa
    if (usdBias === 'Débil') {
      return `Relación inversa con el USD. USD ${usdBias} → ${pair} tiende a *subir*.`
    } else if (usdBias === 'Fuerte') {
      return `Relación inversa con el USD. USD ${usdBias} → ${pair} tiende a *caer*.`
    } else {
      return `Relación inversa con el USD. Movimientos del USD afectan a ${pair} en dirección opuesta.`
    }
  } else if (corr > 0.1) {
    // Relación directa
    if (usdBias === 'Fuerte') {
      return `Relación directa con el USD. USD ${usdBias} → ${pair} tiende a *subir*.`
    } else if (usdBias === 'Débil') {
      return `Relación directa con el USD. USD ${usdBias} → ${pair} tiende a *caer*.`
    } else {
      return `Relación directa con el USD. Movimientos del USD afectan a ${pair} en la misma dirección.`
    }
  } else {
    return `Relación débil con el USD (correlación cercana a 0). Priorizar price action y drivers propios.`
  }
}





