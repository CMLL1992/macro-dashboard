#!/usr/bin/env tsx
/**
 * Script de verificación de integridad de datos macro
 * Compara los datos en la base de datos con las fuentes oficiales (FRED, etc.)
 * 
 * Garantiza que:
 * - Cada indicador está sincronizado con su serie oficial
 * - No hay valores placeholder (0, null) mostrados como datos reales
 * - Las fechas coinciden con las fuentes oficiales
 */

// Cargar variables de entorno
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { getUnifiedDB } from '../lib/db/unified-db'
import { fetchFredSeries } from '../lib/fred'
import { KEY_TO_SERIES_ID } from '../lib/db/read-macro'
import { yoy, mom, last, sma } from '../lib/fred'
import indicatorsMap from '../config/indicators-map.json'

interface VerificationResult {
  id_interno: string
  series_id: string
  fuente: string
  status: 'ok' | 'warning' | 'error'
  db_value: number | null
  db_date: string | null
  official_value: number | null
  official_date: string | null
  difference: number | null
  is_placeholder: boolean
  date_match: boolean
  message: string
}

const FRED_API_KEY = process.env.FRED_API_KEY
if (!FRED_API_KEY) {
  console.error('❌ FRED_API_KEY no configurada en .env.local')
  process.exit(1)
}

async function getDBValue(seriesId: string, transform: string): Promise<{ value: number | null; date: string | null }> {
  const db = getUnifiedDB()
  
  try {
    // Obtener observaciones más recientes
    const observations = await db.prepare(
      `SELECT date, value FROM macro_observations 
       WHERE series_id = ? 
       ORDER BY date DESC 
       LIMIT 100`
    ).all(seriesId) as Array<{ date: string; value: number }>

    if (!observations || observations.length === 0) {
      return { value: null, date: null }
    }

    // Aplicar transformación según el tipo
    let transformed: { value: number; date: string } | null = null

    if (transform === 'raw' || transform === 'lin') {
      transformed = observations[0] as { value: number; date: string }
    } else if (transform === 'yoy') {
      const result = yoy(observations.map(o => ({ date: o.date, value: o.value })))
      transformed = result ? { value: result.value, date: result.date } : null
    } else if (transform === 'mom') {
      const result = mom(observations.map(o => ({ date: o.date, value: o.value })))
      transformed = result ? { value: result.value, date: result.date } : null
    } else if (transform === 'qoq_annualized') {
      // Para GDP QoQ anualizado, necesitamos calcular el cambio trimestral y anualizarlo
      if (observations.length >= 2) {
        const latest = observations[0]
        const previous = observations[1]
        const qoq = ((latest.value / previous.value) - 1) * 100
        const annualized = qoq * 4
        transformed = { value: annualized, date: latest.date }
      }
    } else if (transform === 'sma4w') {
      // Para claims 4W MA, calcular promedio móvil de 4 semanas
      if (observations.length >= 4) {
        const recent = observations.slice(0, 4)
        const avg = recent.reduce((sum, o) => sum + o.value, 0) / recent.length
        transformed = { value: avg, date: recent[0].date }
      }
    }

    return transformed || { value: null, date: null }
  } catch (error: any) {
    console.warn(`[verify-data] Error obteniendo valor de BD para ${seriesId}:`, error.message)
    return { value: null, date: null }
  }
}

async function getOfficialValue(seriesId: string, transform: string): Promise<{ value: number | null; date: string | null }> {
  try {
    const observations = await fetchFredSeries(seriesId, {
      limit: 100,
      units: transform === 'yoy' ? 'pc1' : transform === 'mom' ? 'pca' : 'lin',
    })

    if (!observations || observations.length === 0) {
      return { value: null, date: null }
    }

    const latest = observations[0]
    
    // Para transformaciones especiales, aplicar aquí
    if (transform === 'qoq_annualized' && observations.length >= 2) {
      const latestVal = parseFloat(latest.value)
      const prevVal = parseFloat(observations[1].value)
      const qoq = ((latestVal / prevVal) - 1) * 100
      const annualized = qoq * 4
      return { value: annualized, date: latest.date }
    }

    if (transform === 'sma4w' && observations.length >= 4) {
      const recent = observations.slice(0, 4)
      const avg = recent.reduce((sum, o) => sum + parseFloat(o.value), 0) / recent.length
      return { value: avg, date: recent[0].date }
    }

    return { value: parseFloat(latest.value), date: latest.date }
  } catch (error: any) {
    console.warn(`[verify-data] Error obteniendo valor oficial para ${seriesId}:`, error.message)
    return { value: null, date: null }
  }
}

async function verifyIndicator(indicator: any): Promise<VerificationResult> {
  const { id_interno, series_id, transformacion, umbral_diferencia, valores_placeholder } = indicator

  // Obtener valores de DB y fuente oficial
  const dbData = await getDBValue(series_id, transformacion)
  const officialData = await getOfficialValue(series_id, transformacion)

  // Verificar si es placeholder
  const isPlaceholder = dbData.value !== null && valores_placeholder.includes(dbData.value)

  // Verificar diferencia
  let difference: number | null = null
  let status: 'ok' | 'warning' | 'error' = 'ok'
  let message = ''

  if (dbData.value === null && officialData.value === null) {
    message = 'Sin datos en DB y fuente oficial'
    status = 'warning'
  } else if (dbData.value === null) {
    message = 'Sin datos en DB (hay datos oficiales disponibles)'
    status = 'error'
  } else if (officialData.value === null) {
    message = 'Sin datos oficiales disponibles (puede ser retraso normal)'
    status = 'warning'
  } else {
    difference = Math.abs(dbData.value - officialData.value)
    
    if (isPlaceholder) {
      message = `⚠️ Valor placeholder detectado (${dbData.value})`
      status = 'error'
    } else if (difference > umbral_diferencia) {
      message = `❌ Diferencia excesiva: ${difference.toFixed(4)} (umbral: ${umbral_diferencia})`
      status = 'error'
    } else if (difference > umbral_diferencia * 0.5) {
      message = `⚠️ Diferencia notable: ${difference.toFixed(4)}`
      status = 'warning'
    } else {
      message = '✅ Datos sincronizados'
    }
  }

  // Verificar fecha
  const dateMatch = dbData.date === officialData.date || 
    (dbData.date && officialData.date && Math.abs(
      new Date(dbData.date).getTime() - new Date(officialData.date).getTime()
    ) < 24 * 60 * 60 * 1000) // Permitir diferencia de 1 día

  if (!dateMatch && dbData.date && officialData.date) {
    if (status === 'ok') status = 'warning'
    message += ` | Fechas no coinciden: DB=${dbData.date}, Oficial=${officialData.date}`
  }

  return {
    id_interno,
    series_id,
    fuente: indicator.fuente,
    status,
    db_value: dbData.value,
    db_date: dbData.date,
    official_value: officialData.value,
    official_date: officialData.date,
    difference,
    is_placeholder: isPlaceholder,
    date_match: dateMatch,
    message,
  }
}

async function main() {
  console.log('🔍 Verificación de Integridad de Datos Macro')
  console.log('=' .repeat(80))
  console.log()

  const results: VerificationResult[] = []
  const criticalIndicators = ['payems_delta', 'gdp_qoq', 'unrate']

  // Verificar indicadores críticos primero
  console.log('📊 Verificando indicadores críticos...\n')
  for (const indicator of indicatorsMap.indicators) {
    if (criticalIndicators.includes(indicator.id_interno)) {
      console.log(`Verificando ${indicator.id_interno} (${indicator.series_id})...`)
      const result = await verifyIndicator(indicator)
      results.push(result)
      
      const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      console.log(`  ${icon} ${result.message}`)
      if (result.db_value !== null && result.official_value !== null) {
        console.log(`     DB: ${result.db_value.toFixed(4)} (${result.db_date})`)
        console.log(`     Oficial: ${result.official_value.toFixed(4)} (${result.official_date})`)
      }
      console.log()
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Verificar todos los demás indicadores
  console.log('📊 Verificando resto de indicadores...\n')
  for (const indicator of indicatorsMap.indicators) {
    if (!criticalIndicators.includes(indicator.id_interno)) {
      const result = await verifyIndicator(indicator)
      results.push(result)
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Resumen
  console.log('=' .repeat(80))
  console.log('📊 RESUMEN DE VERIFICACIÓN')
  console.log('=' .repeat(80))
  console.log()

  const ok = results.filter(r => r.status === 'ok').length
  const warnings = results.filter(r => r.status === 'warning').length
  const errors = results.filter(r => r.status === 'error').length
  const placeholders = results.filter(r => r.is_placeholder).length

  console.log(`✅ OK: ${ok}/${results.length}`)
  console.log(`⚠️  Warnings: ${warnings}/${results.length}`)
  console.log(`❌ Errores: ${errors}/${results.length}`)
  console.log(`🔴 Placeholders detectados: ${placeholders}`)
  console.log()

  if (errors > 0 || placeholders > 0) {
    console.log('❌ PROBLEMAS DETECTADOS:\n')
    
    if (placeholders > 0) {
      console.log('🔴 Valores placeholder (mostrados como datos reales):')
      results.filter(r => r.is_placeholder).forEach(r => {
        console.log(`   - ${r.id_interno}: valor=${r.db_value} (debe mostrarse como "Dato pendiente")`)
      })
      console.log()
    }

    if (errors > 0) {
      console.log('❌ Errores de sincronización:')
      results.filter(r => r.status === 'error' && !r.is_placeholder).forEach(r => {
        console.log(`   - ${r.id_interno}: ${r.message}`)
      })
      console.log()
    }
  }

  if (warnings > 0) {
    console.log('⚠️  Advertencias:')
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`   - ${r.id_interno}: ${r.message}`)
    })
    console.log()
  }

  // Tabla detallada
  console.log('📋 DETALLE POR INDICADOR:')
  console.log('=' .repeat(80))
  console.log(
    'Indicador'.padEnd(20) +
    'Estado'.padEnd(10) +
    'DB Valor'.padEnd(15) +
    'Oficial'.padEnd(15) +
    'Diferencia'.padEnd(12) +
    'Fecha Match'
  )
  console.log('-'.repeat(80))

  for (const result of results) {
    const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    const dbVal = result.db_value !== null ? result.db_value.toFixed(2) : 'N/A'
    const offVal = result.official_value !== null ? result.official_value.toFixed(2) : 'N/A'
    const diff = result.difference !== null ? result.difference.toFixed(4) : 'N/A'
    const dateMatch = result.date_match ? '✅' : '❌'

    console.log(
      result.id_interno.padEnd(20) +
      icon.padEnd(10) +
      dbVal.padEnd(15) +
      offVal.padEnd(15) +
      diff.padEnd(12) +
      dateMatch
    )
  }

  console.log()
  console.log('=' .repeat(80))

  if (errors === 0 && placeholders === 0) {
    console.log('🎉 ¡Todos los datos están sincronizados y son reales!')
    process.exit(0)
  } else {
    console.log('⚠️  Se detectaron problemas. Revisa los detalles arriba.')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Error fatal:', error)
  process.exit(1)
})
