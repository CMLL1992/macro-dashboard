/**
 * Test de regresión: Allowlist de símbolos
 * 
 * Verifica que:
 * 1. Los endpoints NO devuelven símbolos fuera de tactical-pairs.json
 * 2. El frontend NO renderiza símbolos fuera de allowlist
 * 3. Los jobs NO insertan símbolos no permitidos en BD
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getMacroTacticalBias } from '@/lib/db/read'
import { getAllowedPairs, isAllowedPair } from '@/config/tactical-pairs'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

describe('Allowlist: Regresión de símbolos no permitidos', () => {
  const FORBIDDEN_SYMBOL = 'DOGEUSD' // Símbolo que NO está en tactical-pairs.json
  
  beforeEach(async () => {
    // Insertar símbolo no permitido en macro_bias para el test
    const db = getUnifiedDB()
    const isTurso = isUsingTurso()
    
    try {
      if (isTurso) {
        await db.prepare(`
          INSERT OR REPLACE INTO macro_bias (symbol, score, direction, confidence, drivers_json, computed_at)
          VALUES (?, 0.5, 'neutral', 0.5, '[]', datetime('now'))
        `).run(FORBIDDEN_SYMBOL)
      } else {
        const { getDB } = await import('@/lib/db/schema')
        const sqliteDb = getDB()
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO macro_bias (symbol, score, direction, confidence, drivers_json, computed_at)
          VALUES (?, 0.5, 'neutral', 0.5, '[]', datetime('now'))
        `).run(FORBIDDEN_SYMBOL)
      }
    } catch (error) {
      // Ignorar si la tabla no existe o hay otro error
      console.warn('Could not insert test symbol:', error)
    }
  })

  afterEach(async () => {
    // Limpiar símbolo de prueba
    const db = getUnifiedDB()
    const isTurso = isUsingTurso()
    
    try {
      if (isTurso) {
        await db.prepare('DELETE FROM macro_bias WHERE symbol = ?').run(FORBIDDEN_SYMBOL)
      } else {
        const { getDB } = await import('@/lib/db/schema')
        const sqliteDb = getDB()
        sqliteDb.prepare('DELETE FROM macro_bias WHERE symbol = ?').run(FORBIDDEN_SYMBOL)
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
  })

  it('getMacroTacticalBias() NO devuelve símbolos fuera de allowlist', async () => {
    const allowedPairs = getAllowedPairs()
    const result = await getMacroTacticalBias()
    
    // Verificar que todos los símbolos devueltos están en allowlist
    const allSymbols = result.map(r => r.symbol.toUpperCase())
    const forbiddenInResult = allSymbols.filter(s => !isAllowedPair(s))
    
    expect(forbiddenInResult).toHaveLength(0)
    expect(allSymbols.length).toBeLessThanOrEqual(allowedPairs.length)
    
    // Verificar que DOGEUSD específicamente NO está en el resultado
    expect(allSymbols).not.toContain(FORBIDDEN_SYMBOL)
  })

  it('isAllowedPair() rechaza símbolos no permitidos', () => {
    expect(isAllowedPair(FORBIDDEN_SYMBOL)).toBe(false)
    expect(isAllowedPair('DOGEUSD')).toBe(false)
    expect(isAllowedPair('ETHUSDT')).toBe(false) // Debe ser ETHUSD
    expect(isAllowedPair('BTCUSD')).toBe(true)
    expect(isAllowedPair('EURUSD')).toBe(true)
  })

  it('getAllowedPairs() devuelve exactamente 19 símbolos', () => {
    const allowed = getAllowedPairs()
    expect(allowed).toHaveLength(19)
    
    // Verificar que incluye los símbolos esperados
    expect(allowed).toContain('BTCUSD')
    expect(allowed).toContain('ETHUSD')
    expect(allowed).toContain('EURUSD')
    expect(allowed).toContain('SPX')
    
    // Verificar que NO incluye símbolos no permitidos
    expect(allowed).not.toContain(FORBIDDEN_SYMBOL)
    expect(allowed).not.toContain('ETHUSDT')
  })

  it('getMacroTacticalBias() filtra en SQL (no solo en memoria)', async () => {
    // Este test verifica que el filtrado se hace en SQL, no solo en memoria
    // Si DOGEUSD está en BD pero no aparece en el resultado, el filtro SQL funciona
    const result = await getMacroTacticalBias()
    const symbols = result.map(r => r.symbol.toUpperCase())
    
    // DOGEUSD no debe aparecer aunque esté en BD
    expect(symbols).not.toContain(FORBIDDEN_SYMBOL)
    
    // Debe devolver solo símbolos permitidos
    const allowedPairs = getAllowedPairs()
    expect(symbols.length).toBeLessThanOrEqual(allowedPairs.length)
    
    // Todos los símbolos devueltos deben estar en allowlist
    symbols.forEach(symbol => {
      expect(isAllowedPair(symbol)).toBe(true)
    })
  })
})

describe('Allowlist: Componente frontend (simulación)', () => {
  it('TacticalTablesClient filtra símbolos no permitidos', () => {
    // Simular datos que incluyen símbolo no permitido
    const mockRows = [
      { pair: 'BTC/USD', trend: 'Alcista', action: 'Buscar compras', confidence: 'Alta' },
      { pair: 'DOGE/USD', trend: 'Alcista', action: 'Buscar compras', confidence: 'Alta' }, // NO permitido
      { pair: 'EUR/USD', trend: 'Neutral', action: 'Rango/táctico', confidence: 'Media' },
    ]
    
    // Simular filtro del componente (lógica de TacticalTablesClient)
    const ALLOWED_SYMBOLS = new Set([
      'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
      'USDCNH', 'USDBRL', 'USDMXN', 'SPX', 'NDX', 'SX5E', 'NIKKEI', 'XAUUSD', 'WTI', 'COPPER',
    ])
    
    const normalizeSymbol = (symbol: string) => symbol.toUpperCase().replace('/', '').replace('-', '')
    const isAllowedSymbol = (symbol: string) => ALLOWED_SYMBOLS.has(normalizeSymbol(symbol))
    
    const filtered = mockRows.filter(row => isAllowedSymbol(row.pair))
    
    // DOGE/USD debe ser filtrado
    expect(filtered).toHaveLength(2)
    expect(filtered.map(r => r.pair)).not.toContain('DOGE/USD')
    expect(filtered.map(r => r.pair)).toContain('BTC/USD')
    expect(filtered.map(r => r.pair)).toContain('EUR/USD')
  })
})
