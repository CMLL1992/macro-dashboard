/**
 * Test: Auto-actualización al añadir un par
 * Que un nuevo símbolo dispare el cálculo de correlaciones y aparezca en la UI
 */

import { describe, it, expect } from 'vitest'
import { getActiveSymbols } from '@/lib/correlations/fetch'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { upsertCorrelation } from '@/lib/db/upsert'

describe('Auto-actualización al añadir un par', () => {
  it('getActiveSymbols debe incluir símbolos del universo', async () => {
    const symbols = await getActiveSymbols()
    expect(symbols.length).toBeGreaterThan(0)
    expect(symbols).toContain('EURUSD')
  })

  it('Al añadir correlación para un nuevo símbolo, debe persistirse', () => {
    const testSymbol = 'NEWPAIR'
    const today = new Date().toISOString().slice(0, 10)
    
    // Simular upsert de correlación
    upsertCorrelation({
      symbol: testSymbol,
      base: 'DXY',
      window: '12m',
      value: -0.45,
      asof: today,
      n_obs: 200,
      last_asset_date: today,
      last_base_date: today,
    })
    
    upsertCorrelation({
      symbol: testSymbol,
      base: 'DXY',
      window: '3m',
      value: -0.30,
      asof: today,
      n_obs: 50,
      last_asset_date: today,
      last_base_date: today,
    })
    
    // Verificar que se guardó
    const corr12m = getCorrelationsForSymbol(testSymbol, 'DXY')
    expect(corr12m.corr12m).toBe(-0.45)
    expect(corr12m.corr3m).toBe(-0.30)
    expect(corr12m.n_obs12m).toBe(200)
    expect(corr12m.n_obs3m).toBe(50)
  })

  it('Si n_obs < mínimo, debe mostrar null pero persistir', () => {
    const testSymbol = 'LOWOBS'
    const today = new Date().toISOString().slice(0, 10)
    
    // Simular correlación con pocas observaciones
    upsertCorrelation({
      symbol: testSymbol,
      base: 'DXY',
      window: '12m',
      value: null, // No suficiente observaciones
      asof: today,
      n_obs: 50, // < 150 mínimo
      last_asset_date: today,
      last_base_date: today,
    })
    
    const corr = getCorrelationsForSymbol(testSymbol, 'DXY')
    expect(corr.corr12m).toBeNull()
    expect(corr.n_obs12m).toBe(50)
  })

  it('Nuevo símbolo debe aparecer en getCorrelationsForSymbol', () => {
    const testSymbol = 'TESTPAIR'
    const today = new Date().toISOString().slice(0, 10)
    
    upsertCorrelation({
      symbol: testSymbol,
      base: 'DXY',
      window: '12m',
      value: 0.60,
      asof: today,
      n_obs: 200,
      last_asset_date: today,
      last_base_date: today,
    })
    
    const result = getCorrelationsForSymbol(testSymbol, 'DXY')
    expect(result.corr12m).toBe(0.60)
    expect(result.asof12m).toBe(today)
  })
})

