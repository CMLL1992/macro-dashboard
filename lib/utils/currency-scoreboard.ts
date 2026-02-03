export type CurrencyStatus = 'Fuerte' | 'Neutro' | 'Débil'

export interface CurrencyRegimeSummary {
  regime?: string
  probability?: number
  description?: string
  // Campos opcionales usados para debug / calidad de señal
  coverage?: number
  presentKeys?: string[]
}

export interface CurrencyScore {
  currency: string
  score: number
  status: CurrencyStatus
}

/**
 * Construye el currencyScoreboard a partir de currencyRegimes del diagnóstico macro.
 *
 * Contrato:
 * - score: número entre -3 y +3 (clamp) derivado de la probabilidad del régimen (0–1).
 * - status:
 *   - 'Fuerte'  si el régimen es claramente pro‑riesgo (goldilocks/reflation) o score > 1.
 *   - 'Débil'   si el régimen es recesivo/estresado (recession/stagflation) o score < -1.
 *   - 'Neutro'  en el resto de casos o cuando faltan datos (probabilidad indefinida → score 0).
 */
export function buildCurrencyScoreboard(
  currencyRegimes: Record<string, CurrencyRegimeSummary> | undefined | null
): CurrencyScore[] {
  if (!currencyRegimes || typeof currencyRegimes !== 'object') {
    return []
  }

  const EXCLUDED_CURRENCIES = new Set(['AUD', 'CNY'])
  const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY'])
  const entries = Object.entries(currencyRegimes)
    .filter(([currency]) => !EXCLUDED_CURRENCIES.has(currency))
    .filter(([currency]) => ALLOWED_CURRENCIES.has(currency))

  // Construir mapa intermedio currency -> CurrencyScore
  const scoresByCurrency: Record<string, CurrencyScore> = {}

  for (const [currency, regime] of entries) {
    // Guard clauses de datos insuficientes
    const regimeLower = (regime?.regime || '').toLowerCase()
    const coverage =
      typeof regime?.coverage === 'number' && Number.isFinite(regime.coverage)
        ? regime.coverage
        : 0
    const presentKeysCount = Array.isArray(regime?.presentKeys) ? regime.presentKeys.length : 0

    // MVP: si hay datos insuficientes, no etiquetamos como Débil/Fuerte: dejamos Neutro
    if (
      regimeLower.includes('insufficient_data') ||
      coverage < 0.25 ||
      presentKeysCount < 3
    ) {
      scoresByCurrency[currency] = { currency, score: 0, status: 'Neutro' as const }
      continue
    }

    // Probabilidad base: si no hay probabilidad, asumimos neutral (0.5 → score 0)
    const rawProb =
      typeof regime?.probability === 'number' && Number.isFinite(regime.probability)
        ? regime.probability
        : 0.5

    let normalizedProb = (rawProb - 0.5) * 6
    if (!Number.isFinite(normalizedProb)) {
      normalizedProb = 0
    }

    let score = Math.max(-3, Math.min(3, normalizedProb))
    if (!Number.isFinite(score)) {
      score = 0
    }

    // Regla de estado por score + datos disponibles
    let status: CurrencyStatus = 'Neutro'

    // Si no tenemos régimen ni probabilidad informativa → neutro (score 0)
    const hasUsefulProb = typeof regime?.probability === 'number' && Number.isFinite(regime.probability)
    if (!hasUsefulProb && !regimeLower) {
      score = 0
      status = 'Neutro'
    } else {
      // Regla de oro: el signo del score manda
      if (score >= 1) {
        status = 'Fuerte'
      } else if (score <= -1) {
        status = 'Débil'
      } else {
        status = 'Neutro'
      }
    }

    scoresByCurrency[currency] = { currency, score, status }
  }

  // Orden explícito y estable por allowlist
  const ORDER: Array<keyof typeof scoresByCurrency> = ['USD', 'EUR', 'GBP', 'JPY']
  return ORDER.map((ccy) => scoresByCurrency[ccy]).filter(
    (v): v is CurrencyScore => !!v,
  )
}

