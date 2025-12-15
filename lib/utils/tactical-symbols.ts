/**
 * Single source of truth for tactical pairs/symbols
 * Reads from tactical-pairs.json and provides utilities for jobs
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TacticalPair {
  symbol: string
  type: 'crypto' | 'fx' | 'index' | 'commodity'
  yahoo_symbol?: string
}

let cachedTacticalPairs: TacticalPair[] | null = null

/**
 * Get tactical pairs from tactical-pairs.json
 * Cached for performance
 */
export function getTacticalSymbols(): TacticalPair[] {
  if (cachedTacticalPairs) {
    return cachedTacticalPairs
  }

  try {
    const configPath = join(process.cwd(), 'config', 'tactical-pairs.json')
    const raw = readFileSync(configPath, 'utf8')
    cachedTacticalPairs = JSON.parse(raw) as TacticalPair[]
    return cachedTacticalPairs
  } catch (error) {
    console.error('Failed to load tactical-pairs.json:', error)
    return []
  }
}

/**
 * Get list of tactical symbol strings (uppercase)
 */
export function getTacticalSymbolStrings(): string[] {
  return getTacticalSymbols().map(p => p.symbol.toUpperCase())
}

/**
 * Check if a symbol is in tactical pairs
 */
export function isTacticalSymbol(symbol: string): boolean {
  const tactical = getTacticalSymbolStrings()
  return tactical.includes(symbol.toUpperCase())
}

/**
 * Get tactical pairs grouped by category for asset ingestion
 */
export function getTacticalAssetsByCategory(): {
  forex: Array<{ symbol: string; yahoo_symbol?: string; name?: string }>
  index: Array<{ symbol: string; yahoo_symbol?: string; name?: string }>
  metal: Array<{ symbol: string; yahoo_symbol?: string; name?: string }>
  crypto: Array<{ symbol: string; yahoo_symbol?: string; name?: string }>
  commodity: Array<{ symbol: string; yahoo_symbol?: string; name?: string }>
} {
  const pairs = getTacticalSymbols()
  
  const result = {
    forex: [] as Array<{ symbol: string; yahoo_symbol?: string; name?: string }>,
    index: [] as Array<{ symbol: string; yahoo_symbol?: string; name?: string }>,
    metal: [] as Array<{ symbol: string; yahoo_symbol?: string; name?: string }>,
    crypto: [] as Array<{ symbol: string; yahoo_symbol?: string; name?: string }>,
    commodity: [] as Array<{ symbol: string; yahoo_symbol?: string; name?: string }>,
  }

  for (const pair of pairs) {
    const item = {
      symbol: pair.symbol,
      yahoo_symbol: pair.yahoo_symbol,
      name: pair.symbol, // Default name to symbol
    }

    switch (pair.type) {
      case 'fx':
        result.forex.push(item)
        break
      case 'index':
        result.index.push(item)
        break
      case 'crypto':
        result.crypto.push(item)
        break
      case 'commodity':
        // Metals and commodities are separate in assets.config.json, but tactical-pairs uses 'commodity'
        // We'll put XAUUSD in metals, others in commodity
        if (pair.symbol === 'XAUUSD') {
          result.metal.push(item)
        } else {
          result.commodity.push(item)
        }
        break
    }
  }

  return result
}
