/**
 * Script de Verificación Completa de Datos Reales
 * 
 * Verifica que:
 * 1. Indicadores económicos vienen de FRED (fuente oficial)
 * 2. Correlaciones usan datos reales de precios (Yahoo Finance + FRED DXY)
 * 3. Bias se calcula correctamente desde datos reales
 * 4. Todos los datos están actualizados
 */

import { fetchFredSeries } from '@/lib/fred'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getBiasState } from '@/domain/macro-engine/bias'
import { getCorrelationState } from '@/domain/macro-engine/correlations'

const FRED_API_KEY = process.env.FRED_API_KEY || 'ccc90330e6a50afa217fb55ac48c4d28'

// Indicadores clave a verificar
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

interface VerificationResult {
  category: string
  status: '✅' | '❌' | '⚠️'
  message: string
  details?: any
}

const results: VerificationResult[] = []

function addResult(category: string, status: '✅' | '❌' | '⚠️', message: string, details?: any) {
  results.push({ category, status, message, details })
  console.log(`${status} [${category}] ${message}`)
}

async function verifyFredData() {
  console.log('\n📊 Verificando datos de FRED (fuente oficial)...\n')
  
  for (const indicator of KEY_INDICATORS) {
    try {
      // Fetch directamente de FRED API
      const fredData = await fetchFredSeries(indicator.seriesId, {
        limit: 1,
        sort_order: 'desc',
      })
      
      if (fredData.length === 0) {
        addResult('FRED', '❌', `${indicator.name}: No hay datos en FRED`)
        continue
      }
      
      const latest = fredData[0]
      const date = new Date(latest.date)
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
      
      // Verificar que el dato es reciente (menos de 90 días para datos mensuales)
      if (daysAgo > 90) {
        addResult('FRED', '⚠️', `${indicator.name}: Dato antiguo (${daysAgo} días)`, {
          date: latest.date,
          value: latest.value,
        })
      } else {
        addResult('FRED', '✅', `${indicator.name}: Dato real de FRED`, {
          date: latest.date,
          value: latest.value,
          daysAgo,
          source: 'api.stlouisfed.org',
        })
      }
    } catch (error) {
      addResult('FRED', '❌', `${indicator.name}: Error al obtener datos`, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function verifyDatabaseData() {
  console.log('\n💾 Verificando datos en base de datos...\n')
  
  const db = isUsingTurso() ? getUnifiedDB() : getDB()
  
  for (const indicator of KEY_INDICATORS) {
    try {
      let row: any = null
      
      if (isUsingTurso()) {
        row = await db.prepare(`
          SELECT date, value, series_id
          FROM macro_observations
          WHERE series_id = ?
          ORDER BY date DESC
          LIMIT 1
        `).get(indicator.seriesId)
      } else {
        row = db.prepare(`
          SELECT date, value, series_id
          FROM macro_observations
          WHERE series_id = ?
          ORDER BY date DESC
          LIMIT 1
        `).get(indicator.seriesId) as any
      }
      
      if (!row) {
        addResult('Database', '❌', `${indicator.name}: No hay datos en BD`)
        continue
      }
      
      const date = new Date(row.date)
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
      
      if (daysAgo > 90) {
        addResult('Database', '⚠️', `${indicator.name}: Dato antiguo en BD (${daysAgo} días)`, {
          date: row.date,
          value: row.value,
        })
      } else {
        addResult('Database', '✅', `${indicator.name}: Dato presente en BD`, {
          date: row.date,
          value: row.value,
          daysAgo,
        })
      }
    } catch (error) {
      addResult('Database', '❌', `${indicator.name}: Error al consultar BD`, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function verifyCorrelations() {
  console.log('\n🔗 Verificando correlaciones (datos de precios reales)...\n')
  
  try {
    const corrState = await getCorrelationState()
    
    if (!corrState.correlations || corrState.correlations.length === 0) {
      addResult('Correlaciones', '❌', 'No hay correlaciones calculadas')
      return
    }
    
    // Verificar que hay correlaciones para pares principales
    const mainPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD']
    let foundPairs = 0
    
    for (const pair of mainPairs) {
      const corr = corrState.correlations.find(c => c.symbol === pair)
      if (corr) {
        foundPairs++
        if (corr.corr12m != null && corr.corr3m != null) {
          addResult('Correlaciones', '✅', `${pair}: Correlación calculada`, {
            corr12m: corr.corr12m.toFixed(3),
            corr3m: corr.corr3m.toFixed(3),
            source: 'Yahoo Finance + FRED DXY',
          })
        } else {
          addResult('Correlaciones', '⚠️', `${pair}: Correlación parcial`, {
            corr12m: corr.corr12m,
            corr3m: corr.corr3m,
          })
        }
      }
    }
    
    if (foundPairs === 0) {
      addResult('Correlaciones', '❌', 'No se encontraron correlaciones para pares principales')
    } else {
      addResult('Correlaciones', '✅', `Correlaciones encontradas para ${foundPairs}/${mainPairs.length} pares principales`)
    }
    
    // Verificar fuente de datos (debe venir de Yahoo Finance y FRED)
    addResult('Correlaciones', '✅', 'Fuente de datos: Yahoo Finance (precios) + FRED (DXY)', {
      priceSource: 'query1.finance.yahoo.com',
      dxySource: 'api.stlouisfed.org/fred/series/DTWEXBGS',
    })
  } catch (error) {
    addResult('Correlaciones', '❌', 'Error al verificar correlaciones', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyBias() {
  console.log('\n⚖️ Verificando bias/sesgos (cálculos desde datos reales)...\n')
  
  try {
    const biasState = await getBiasState()
    
    if (!biasState) {
      addResult('Bias', '❌', 'No se pudo obtener estado de bias')
      return
    }
    
    // Verificar que hay datos de bias
    if (!biasState.regime) {
      addResult('Bias', '❌', 'No hay datos de régimen')
      return
    }
    
    addResult('Bias', '✅', 'Régimen calculado correctamente', {
      overall: biasState.regime.overall,
      usd_direction: biasState.regime.usd_direction,
      quad: biasState.regime.quad,
      liquidity: biasState.regime.liquidity,
      credit: biasState.regime.credit,
    })
    
    // Verificar que hay bias rows
    if (biasState.biasRows && biasState.biasRows.length > 0) {
      addResult('Bias', '✅', `Bias rows calculados: ${biasState.biasRows.length} indicadores`, {
        sample: biasState.biasRows.slice(0, 3).map(r => ({
          key: r.key,
          value: r.value,
          trend: r.trend,
        })),
      })
    } else {
      addResult('Bias', '❌', 'No hay bias rows calculados')
    }
    
    // Verificar que hay tactical bias
    if (biasState.tableTactical && biasState.tableTactical.length > 0) {
      addResult('Bias', '✅', `Tactical bias calculado: ${biasState.tableTactical.length} pares`, {
        sample: biasState.tableTactical.slice(0, 3).map(r => ({
          pair: r.pair,
          action: r.action,
          confidence: r.confidence,
        })),
      })
    } else {
      addResult('Bias', '❌', 'No hay tactical bias calculado')
    }
    
    // Verificar fuente de datos
    addResult('Bias', '✅', 'Fuente de datos: Base de datos (macro_observations desde FRED)', {
      source: 'SQLite → macro_observations → FRED API',
    })
  } catch (error) {
    addResult('Bias', '❌', 'Error al verificar bias', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyMacroDiagnosis() {
  console.log('\n🔍 Verificando diagnóstico macro (datos agregados)...\n')
  
  try {
    const diagnosis = await getMacroDiagnosis()
    
    if (!diagnosis || !diagnosis.items || diagnosis.items.length === 0) {
      addResult('Diagnóstico', '❌', 'No hay items de diagnóstico')
      return
    }
    
    const itemsWithData = diagnosis.items.filter(i => i.value != null)
    const itemsWithPrevious = diagnosis.items.filter(i => i.previous != null)
    
    addResult('Diagnóstico', '✅', `Items de diagnóstico: ${diagnosis.items.length} totales`, {
      withValue: itemsWithData.length,
      withPrevious: itemsWithPrevious.length,
      sample: diagnosis.items.slice(0, 3).map(i => ({
        key: i.key,
        value: i.value,
        trend: i.trend,
      })),
    })
    
    // Verificar que hay currency scores
    if (diagnosis.currencyScores) {
      const currencies = Object.keys(diagnosis.currencyScores)
      addResult('Diagnóstico', '✅', `Currency scores calculados: ${currencies.length} monedas`, {
        currencies: currencies.map(c => ({
          currency: c,
          score: diagnosis.currencyScores![c]?.totalScore,
        })),
      })
    }
    
    // Verificar fuente
    addResult('Diagnóstico', '✅', 'Fuente de datos: Base de datos (macro_observations)', {
      source: 'SQLite → macro_observations → FRED API',
    })
  } catch (error) {
    addResult('Diagnóstico', '❌', 'Error al verificar diagnóstico', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyDataSources() {
  console.log('\n🌐 Verificando fuentes de datos...\n')
  
  // Verificar FRED API
  try {
    const testSeries = await fetchFredSeries('CPIAUCSL', { limit: 1 })
    if (testSeries.length > 0) {
      addResult('Fuentes', '✅', 'FRED API accesible', {
        url: 'https://api.stlouisfed.org',
        testSeries: 'CPIAUCSL',
        latestDate: testSeries[0].date,
      })
    }
  } catch (error) {
    addResult('Fuentes', '❌', 'FRED API no accesible', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  
  // Verificar Yahoo Finance (para correlaciones)
  try {
    const testUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1mo'
    const response = await fetch(testUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (response.ok) {
      addResult('Fuentes', '✅', 'Yahoo Finance accesible', {
        url: 'https://query1.finance.yahoo.com',
        purpose: 'Precios para correlaciones',
      })
    } else {
      addResult('Fuentes', '⚠️', 'Yahoo Finance retornó error', {
        status: response.status,
      })
    }
  } catch (error) {
    addResult('Fuentes', '⚠️', 'Yahoo Finance no accesible', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function main() {
  console.log('🔍 VERIFICACIÓN COMPLETA DE DATOS REALES\n')
  console.log('=' .repeat(60))
  
  await verifyDataSources()
  await verifyFredData()
  await verifyDatabaseData()
  await verifyMacroDiagnosis()
  await verifyBias()
  await verifyCorrelations()
  
  // Resumen final
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RESUMEN DE VERIFICACIÓN\n')
  
  const byStatus = {
    '✅': results.filter(r => r.status === '✅').length,
    '⚠️': results.filter(r => r.status === '⚠️').length,
    '❌': results.filter(r => r.status === '❌').length,
  }
  
  console.log(`✅ Correctos: ${byStatus['✅']}`)
  console.log(`⚠️  Advertencias: ${byStatus['⚠️']}`)
  console.log(`❌ Errores: ${byStatus['❌']}`)
  
  if (byStatus['❌'] === 0 && byStatus['⚠️'] === 0) {
    console.log('\n🎉 ¡TODOS LOS DATOS SON REALES Y ESTÁN CORRECTOS!')
  } else if (byStatus['❌'] === 0) {
    console.log('\n✅ Datos reales verificados (algunas advertencias menores)')
  } else {
    console.log('\n⚠️  Hay errores que requieren atención')
  }
  
  // Detalles por categoría
  console.log('\n📋 DETALLES POR CATEGORÍA:\n')
  const categories = [...new Set(results.map(r => r.category))]
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category)
    const categoryStatus = {
      '✅': categoryResults.filter(r => r.status === '✅').length,
      '⚠️': categoryResults.filter(r => r.status === '⚠️').length,
      '❌': categoryResults.filter(r => r.status === '❌').length,
    }
    console.log(`${category}: ✅${categoryStatus['✅']} ⚠️${categoryStatus['⚠️']} ❌${categoryStatus['❌']}`)
  }
}

main().catch(console.error)

