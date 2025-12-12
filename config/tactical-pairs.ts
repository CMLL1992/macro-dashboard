/**
 * Single source of truth for tactical pairs
 * All tactical pair logic should import from this module
 */

import tacticalPairsJson from './tactical-pairs.json'

export type TacticalPair = {
  symbol: string
  type?: string
  yahoo_symbol?: string
}

export const TACTICAL_PAIRS: TacticalPair[] = tacticalPairsJson as TacticalPair[]

// Normalize symbols: uppercase, remove slashes
const normalizeSymbol = (symbol: string): string => {
  return symbol.toUpperCase().replace('/', '').replace('-', '')
}

// Create a Set of normalized symbols for fast lookup
export const TACTICAL_PAIR_SET = new Set(
  TACTICAL_PAIRS.map(p => normalizeSymbol(p.symbol))
)

/**
 * Check if a pair is allowed (in tactical-pairs.json)
 * Handles various formats: "EUR/USD", "EURUSD", "eurusd", etc.
 */
export function isAllowedPair(pair: string | null | undefined): boolean {
  if (!pair) return false
  const normalized = normalizeSymbol(pair)
  return TACTICAL_PAIR_SET.has(normalized)
}

/**
 * Get all allowed pair symbols (normalized)
 */
export function getAllowedPairs(): string[] {
  return Array.from(TACTICAL_PAIR_SET).sort()
}
