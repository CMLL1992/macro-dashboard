/**
 * Helper de debug para verificar valores de indicadores
 * Imprime valores raw y scaled para comparar con Investing/calendarios económicos
 */

import { getIndicatorConfig } from '@/config/macro-indicators'

/**
 * Debug helper para verificar valores de indicadores
 * @param indicatorKey - Clave del indicador (ej: 'jolts_openings', 'retail_yoy')
 * @param rawValue - Valor crudo de la fuente (FRED, TradingEconomics, etc.)
 * @param context - Contexto adicional para el log
 */
export function debugIndicatorValue(
  indicatorKey: string,
  rawValue: number | null | undefined,
  context?: { seriesId?: string; date?: string }
): void {
  if (process.env.NODE_ENV !== 'development' && !process.env.DEBUG_INDICATORS) {
    return
  }

  const config = getIndicatorConfig(indicatorKey)
  if (!config) {
    console.log(`[DEBUG] ${indicatorKey}: No config found`)
    return
  }

  if (rawValue === null || rawValue === undefined) {
    console.log(`[DEBUG] ${indicatorKey}: RAW=${rawValue}, SCALED=null`)
    return
  }

  const scaled = rawValue * config.scale
  const rounded = Number(scaled.toFixed(config.decimals))

  console.log(`[DEBUG] ${indicatorKey} (${config.label}):`, {
    raw: rawValue,
    scale: config.scale,
    scaled: scaled,
    rounded,
    unit: config.unit,
    decimals: config.decimals,
    ...context,
  })
}













