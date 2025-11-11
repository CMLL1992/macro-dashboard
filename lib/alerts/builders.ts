/**
 * Message builders for Telegram alerts
 * Single source of truth for message templates
 */

import type { USDState } from './state'

/**
 * Build USD regime change message
 */
export function buildUSDChangeMessage(
  prev: USDState | null,
  current: USDState,
  regime: string,
  score: number,
  latestDataDate: string | null,
  categoryChips: string
): string {
  const prevText = prev || 'N/A'
  const dateText = latestDataDate ? latestDataDate : 'N/A'
  
  let impactText = ''
  if (current === 'Fuerte') {
    impactText = `
Impacto típico:
- EURUSD, SPX, XAU: sesgo bajista (relación inversa).
- USDJPY, USDCAD: sesgo alcista (relación directa).`
  } else if (current === 'Débil') {
    impactText = `
Impacto típico:
- EURUSD, SPX, XAU: sesgo alcista (relación inversa).
- USDJPY, USDCAD: sesgo bajista (relación directa).`
  } else {
    impactText = `
Impacto típico:
- Contexto neutral; priorizar price action y drivers específicos.`
  }
  
  return `💵 *Cambio USD*: de *${prevText}* → *${current}*

Régimen: ${regime} (score ${score.toFixed(2)})
Datos macro hasta: ${dateText}
${categoryChips ? `Coherencia: ${categoryChips}` : ''}
${impactText}

#macro #usd`
}

/**
 * Build correlation threshold cross message
 */
export function buildCorrelationChangeMessage(
  symbol: string,
  window: '3m' | '12m',
  newLevel: string,
  value: number,
  signal: 'Directa' | 'Inversa' | 'Neutra',
  corr12m: number | null,
  corr3m: number | null
): string {
  const corr12mText = corr12m != null ? corr12m.toFixed(2) : 'N/A'
  const corr3mText = corr3m != null ? corr3m.toFixed(2) : 'N/A'
  
  let readingText = ''
  if (signal === 'Directa') {
    readingText = `
Lectura:
- USD ↑ ⇒ ${symbol} ↑
- USD ↓ ⇒ ${symbol} ↓`
  } else if (signal === 'Inversa') {
    readingText = `
Lectura:
- USD ↑ ⇒ ${symbol} ↓
- USD ↓ ⇒ ${symbol} ↑`
  } else {
    readingText = `
Lectura:
- Relación débil; priorizar drivers propios.`
  }
  
  return `🔗 *Correlación ${window} cambió* — ${symbol}

Nuevo nivel: *${newLevel}* (${value.toFixed(2)})
Señal: ${signal}
Nota: 12m=${corr12mText} · 3m=${corr3mText}
${readingText}

#correlaciones #usd`
}

/**
 * Build macro release message
 */
export function buildMacroReleaseMessage(
  label: string,
  current: number | string,
  previous: number | string | null,
  date: string,
  trend: 'Mejora' | 'Empeora' | 'Estable',
  posture: 'Hawkish' | 'Dovish' | 'Neutral',
  effectText: string,
  seriesId: string
): string {
  const prevText = previous != null ? String(previous) : 'N/A'
  const currentText = typeof current === 'number' ? current.toFixed(2) : String(current)
  
  // Get hashtag from series ID
  const hashtag = seriesId.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  return `🗓️ *Nuevo dato macro*: ${label}

Actual: ${currentText} · Anterior: ${prevText} · Fecha: ${date}
Lectura: ${trend} — ${posture}

Efecto típico sobre USD:
${effectText}

#macro #datos #${hashtag}`
}

/**
 * Get effect text for macro indicator
 */
export function getMacroEffectText(
  seriesId: string,
  trend: 'Mejora' | 'Empeora' | 'Estable',
  posture: 'Hawkish' | 'Dovish' | 'Neutral'
): string {
  const effects: Record<string, Record<string, string>> = {
    CPIAUCSL: {
      Mejora: 'Inflación cede ⇒ USD tiende a debilitarse.',
      Empeora: 'Inflación sube ⇒ USD tiende a fortalecerse.',
      Estable: 'Inflación estable; mantener vigilancia.',
    },
    CPILFESL: {
      Mejora: 'Core CPI cede ⇒ presión bajista sobre USD.',
      Empeora: 'Core CPI sube ⇒ presión alcista sobre USD.',
      Estable: 'Core CPI estable; esperar confirmación.',
    },
    PCEPI: {
      Mejora: 'PCE cede ⇒ USD tiende a debilitarse.',
      Empeora: 'PCE sube ⇒ USD tiende a fortalecerse.',
      Estable: 'PCE estable; mantener vigilancia.',
    },
    PCEPILFE: {
      Mejora: 'Core PCE cede ⇒ presión bajista sobre USD.',
      Empeora: 'Core PCE sube ⇒ presión alcista sobre USD.',
      Estable: 'Core PCE estable; esperar confirmación.',
    },
    PAYEMS: {
      Mejora: 'NFP fuerte ⇒ USD tiende a fortalecerse.',
      Empeora: 'NFP débil ⇒ USD tiende a debilitarse.',
      Estable: 'NFP estable; mantener vigilancia.',
    },
    UNRATE: {
      Mejora: 'Desempleo sube ⇒ USD tiende a debilitarse.',
      Empeora: 'Desempleo baja ⇒ USD tiende a fortalecerse.',
      Estable: 'Desempleo estable; mantener vigilancia.',
    },
    T10Y2Y: {
      Mejora: 'Curva se normaliza ⇒ USD tiende a fortalecerse.',
      Empeora: 'Curva se invierte más ⇒ USD tiende a debilitarse.',
      Estable: 'Curva estable; mantener vigilancia.',
    },
    VIXCLS: {
      Mejora: 'VIX baja (riesgo bajo) ⇒ USD tiende a fortalecerse.',
      Empeora: 'VIX sube (riesgo alto) ⇒ USD tiende a debilitarse.',
      Estable: 'VIX estable; mantener vigilancia.',
    },
  }
  
  const seriesEffects = effects[seriesId]
  if (seriesEffects && seriesEffects[trend]) {
    return seriesEffects[trend]
  }
  
  // Default effect
  if (posture === 'Hawkish') {
    return 'Lectura hawkish ⇒ USD tiende a fortalecerse.'
  } else if (posture === 'Dovish') {
    return 'Lectura dovish ⇒ USD tiende a debilitarse.'
  }
  return 'Lectura neutral; mantener vigilancia.'
}



