import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { logger } from '@/lib/obs/logger'

export type HistoricalConfidence = {
  symbol: string
  confidencePct: number
  totalSignals: number
  successfulSignals: number
}

/**
 * Calcula la Confianza Dinámica Histórica del Sesgo
 * Responde: "¿Este sesgo forma parte de cosas que suelen funcionar o es ruido?"
 * 
 * Por ahora, retorna datos simulados hasta que tengamos suficiente historial.
 * En producción, esto debería leer de pair_signals y calcular éxito real.
 */
export async function calculateHistoricalConfidence(
  symbol: string
): Promise<HistoricalConfidence | null> {
  try {
    const db = await getUnifiedDB()
    const isTursoEnv = isUsingTurso()

    // Buscar señales históricas para este símbolo
    // Por ahora, si no hay datos suficientes, retornamos null
    // En el futuro, esto calculará el % de éxito real

    let signals: Array<{
      date: string
      action: string
      confidence: string
    }> = []

    if (isTursoEnv) {
      const result = await db
        .prepare(
          `
        SELECT date, action, confidence
        FROM pair_signals
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT 50
      `
        )
        .all(symbol.toUpperCase())

      signals = (result as any[]).map((row) => ({
        date: row.date,
        action: row.action || '',
        confidence: row.confidence || '',
      }))
    } else {
      const { getDB } = await import('@/lib/db/schema')
      const dbSync = getDB()
      const rows = dbSync
        .prepare(
          `
        SELECT date, action, confidence
        FROM pair_signals
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT 50
      `
        )
        .all(symbol.toUpperCase()) as any[]

      signals = rows.map((row) => ({
        date: row.date,
        action: row.action || '',
        confidence: row.confidence || '',
      }))
    }

    if (signals.length < 5) {
      // No hay suficientes datos históricos
      return null
    }

    // Por ahora, simulamos confianza basada en la consistencia de las señales
    // En producción, esto debería comparar con movimientos de precio reales
    const totalSignals = signals.length
    const highConfidenceSignals = signals.filter((s) =>
      s.confidence.toLowerCase().includes('alta')
    ).length

    // Simulación: asumimos que señales de alta confianza tienen mejor tasa de éxito
    // En producción, esto debería leer precios y calcular retornos reales
    const simulatedSuccessRate = highConfidenceSignals / totalSignals * 0.7 + 0.3

    return {
      symbol,
      confidencePct: Math.round(simulatedSuccessRate * 100),
      totalSignals,
      successfulSignals: Math.round(simulatedSuccessRate * totalSignals),
    }
  } catch (error) {
    logger.error('[calculateHistoricalConfidence] Error:', error)
    return null
  }
}

/**
 * Calcula confianza histórica para múltiples símbolos
 */
export async function calculateHistoricalConfidenceBatch(
  symbols: string[]
): Promise<Map<string, HistoricalConfidence>> {
  const results = new Map<string, HistoricalConfidence>()

  for (const symbol of symbols) {
    const conf = await calculateHistoricalConfidence(symbol)
    if (conf) {
      results.set(symbol, conf)
    }
  }

  return results
}
