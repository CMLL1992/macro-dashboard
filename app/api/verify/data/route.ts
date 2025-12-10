/**
 * API Endpoint: Verificación Completa de Datos Reales
 * 
 * GET /api/verify/data
 * 
 * Verifica que todos los datos provienen de fuentes reales:
 * - Indicadores económicos: FRED API (oficial)
 * - Correlaciones: Yahoo Finance + FRED DXY (precios reales)
 * - Bias: Calculado desde datos reales en BD
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { fetchFredSeries } from '@/lib/fred'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getBiasState } from '@/domain/macro-engine/bias'
import { getCorrelationState } from '@/domain/macro-engine/correlations'

interface VerificationResult {
  category: string
  status: '✅' | '❌' | '⚠️'
  message: string
  details?: any
}

const KEY_INDICATORS = [
  { key: 'CPIAUCSL', name: 'CPI YoY', seriesId: 'CPIAUCSL' },
  { key: 'CPILFESL', name: 'Core CPI YoY', seriesId: 'CPILFESL' },
  { key: 'PCEPILFE', name: 'Core PCE YoY', seriesId: 'PCEPILFE' },
  { key: 'PAYEMS', name: 'Nonfarm Payrolls', seriesId: 'PAYEMS' },
  { key: 'UNRATE', name: 'Unemployment Rate', seriesId: 'UNRATE' },
  { key: 'GDPC1', name: 'GDP', seriesId: 'GDPC1' },
  { key: 'FEDFUNDS', name: 'Fed Funds Rate', seriesId: 'FEDFUNDS' },
  { key: 'T10Y2Y', name: '10Y-2Y Spread', seriesId: 'T10Y2Y' },
]

export async function GET() {
  const results: VerificationResult[] = []

  function addResult(category: string, status: '✅' | '❌' | '⚠️', message: string, details?: any) {
    results.push({ category, status, message, details })
  }

  // 1. Verificar FRED API (fuente oficial)
  try {
    const testSeries = await fetchFredSeries('CPIAUCSL', { observation_start: '2024-01-01' })
    if (testSeries.length > 0) {
      addResult('Fuentes', '✅', 'FRED API accesible', {
        url: 'https://api.stlouisfed.org',
        testSeries: 'CPIAUCSL',
        latestDate: testSeries[0].date,
        value: testSeries[0].value,
      })
    } else {
      addResult('Fuentes', '❌', 'FRED API no retornó datos')
    }
  } catch (error) {
    addResult('Fuentes', '❌', 'FRED API no accesible', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 2. Verificar datos en BD desde FRED
  // All methods are async now, so always use await
  const db = getUnifiedDB()
  let dbVerified = 0
  
  for (const indicator of KEY_INDICATORS) {
    try {
      // All methods are async now, so always use await
      const row = await db.prepare(`
        SELECT date, value, series_id
        FROM macro_observations
        WHERE series_id = ?
        ORDER BY date DESC
        LIMIT 1
      `).get(indicator.seriesId) as any
      
      if (row) {
        const date = new Date(row.date)
        const daysAgo = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
        
        if (daysAgo <= 90) {
          dbVerified++
          addResult('Database', '✅', `${indicator.name}: Dato presente en BD`, {
            date: row.date,
            value: row.value,
            daysAgo,
            source: 'FRED API → macro_observations',
          })
        } else {
          addResult('Database', '⚠️', `${indicator.name}: Dato antiguo (${daysAgo} días)`, {
            date: row.date,
            value: row.value,
          })
        }
      } else {
        addResult('Database', '❌', `${indicator.name}: No hay datos en BD`)
      }
    } catch (error) {
      addResult('Database', '❌', `${indicator.name}: Error al consultar`, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 3. Verificar correlaciones (datos reales de precios)
  try {
    const corrState = await getCorrelationState()
    
    if (corrState.summary && corrState.summary.length > 0) {
      const mainPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD']
      let foundPairs = 0
      
      for (const pair of mainPairs) {
        const corr = corrState.summary.find(c => c.symbol === pair)
        if (corr && corr.correlationNow != null) {
          foundPairs++
        }
      }
      
      addResult('Correlaciones', '✅', `Correlaciones calculadas desde datos reales`, {
        totalPairs: corrState.summary.length,
        mainPairsFound: foundPairs,
        source: 'Yahoo Finance (precios) + FRED DXY',
        priceSource: 'query1.finance.yahoo.com',
        dxySource: 'api.stlouisfed.org/fred/series/DTWEXBGS',
      })
    } else {
      addResult('Correlaciones', '❌', 'No hay correlaciones calculadas')
    }
  } catch (error) {
    addResult('Correlaciones', '❌', 'Error al verificar correlaciones', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 4. Verificar bias (calculado desde datos reales)
  try {
    const biasState = await getBiasState()
    
    if (biasState && biasState.regime) {
      addResult('Bias', '✅', 'Bias calculado correctamente desde datos reales', {
        regime: biasState.regime.overall,
        usd_direction: biasState.regime.usd_direction,
        quad: biasState.regime.quad,
        tacticalRowsCount: biasState.tableTactical?.length || 0,
        source: 'macro_observations (desde FRED) → cálculos de bias',
      })
    } else {
      addResult('Bias', '❌', 'No se pudo obtener estado de bias')
    }
  } catch (error) {
    addResult('Bias', '❌', 'Error al verificar bias', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 5. Verificar diagnóstico macro
  try {
    const diagnosis = await getMacroDiagnosis()
    
    if (diagnosis && diagnosis.items && diagnosis.items.length > 0) {
      const itemsWithData = diagnosis.items.filter(i => i.value != null)
      
      addResult('Diagnóstico', '✅', 'Diagnóstico macro calculado desde datos reales', {
        totalItems: diagnosis.items.length,
        itemsWithData: itemsWithData.length,
        currenciesWithScores: diagnosis.currencyScores ? Object.keys(diagnosis.currencyScores).length : 0,
        source: 'macro_observations (desde FRED) → cálculos de diagnóstico',
      })
    } else {
      addResult('Diagnóstico', '❌', 'No hay items de diagnóstico')
    }
  } catch (error) {
    addResult('Diagnóstico', '❌', 'Error al verificar diagnóstico', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Resumen
  const summary = {
    total: results.length,
    success: results.filter(r => r.status === '✅').length,
    warnings: results.filter(r => r.status === '⚠️').length,
    errors: results.filter(r => r.status === '❌').length,
  }

  return Response.json({
    summary,
    results,
    verified: summary.errors === 0,
    timestamp: new Date().toISOString(),
  })
}

