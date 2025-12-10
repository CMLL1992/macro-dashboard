#!/usr/bin/env tsx
/**
 * Script para verificar que todos los datos sean reales y actualizados
 * Compara datos de la base de datos con las APIs oficiales
 */

import { getDB } from '@/lib/db/schema'
import { fetchFredSeries } from '@/lib/fred'

const FRED_API_KEY = process.env.FRED_API_KEY || 'ccc90330e6a50afa217fb55ac48c4d28'
const TODAY = new Date().toISOString().slice(0, 10) // 2025-12-08

interface VerificationResult {
  seriesId: string
  dbLatestDate: string | null
  dbLatestValue: number | null
  apiLatestDate: string | null
  apiLatestValue: number | null
  match: boolean
  error?: string
}

async function verifySeries(seriesId: string): Promise<VerificationResult> {
  const db = getDB()
  
  // Get latest from database
  const dbResult = db
    .prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 1')
    .get(seriesId) as { date: string; value: number } | undefined

  const dbLatestDate = dbResult?.date || null
  const dbLatestValue = dbResult?.value || null

  try {
    // Fetch from FRED API
    const observations = await fetchFredSeries(seriesId, {
      observation_end: TODAY,
      observation_start: '2024-01-01', // Last year for comparison
    })

    if (observations.length === 0) {
      return {
        seriesId,
        dbLatestDate,
        dbLatestValue,
        apiLatestDate: null,
        apiLatestValue: null,
        match: false,
        error: 'No data from API',
      }
    }

    const latest = observations[observations.length - 1]
    const apiLatestDate = latest.date
    const apiLatestValue = latest.value

    // Check if dates match (within reasonable range)
    const dateMatch = dbLatestDate === apiLatestDate || 
                      (dbLatestDate && apiLatestDate && 
                       Math.abs(new Date(dbLatestDate).getTime() - new Date(apiLatestDate).getTime()) < 7 * 24 * 60 * 60 * 1000) // Within 7 days

    // Check if values match (within 0.1% tolerance for rounding)
    const valueMatch = dbLatestValue !== null && apiLatestValue !== null &&
                      Math.abs(dbLatestValue - apiLatestValue) / Math.abs(apiLatestValue) < 0.001

    return {
      seriesId,
      dbLatestDate,
      dbLatestValue,
      apiLatestDate,
      apiLatestValue,
      match: dateMatch && valueMatch,
      error: !dateMatch ? 'Date mismatch' : !valueMatch ? 'Value mismatch' : undefined,
    }
  } catch (error) {
    return {
      seriesId,
      dbLatestDate,
      dbLatestValue,
      apiLatestDate: null,
      apiLatestValue: null,
      match: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🔍 Verificando que los datos sean reales y actualizados...\n')
  console.log(`📅 Fecha de referencia: ${TODAY}\n`)

  const db = getDB()
  
  // Get all series IDs
  const seriesIds = db
    .prepare('SELECT DISTINCT series_id FROM macro_observations ORDER BY series_id')
    .all() as Array<{ series_id: string }>

  console.log(`📊 Encontradas ${seriesIds.length} series en la base de datos\n`)

  const results: VerificationResult[] = []
  const importantSeries = ['T10Y2Y', 'CPIAUCSL', 'CPILFESL', 'UNRATE', 'PAYEMS', 'GDPC1', 'FEDFUNDS', 'VIXCLS']

  // Verify important series first
  for (const seriesId of importantSeries) {
    if (seriesIds.some(s => s.series_id === seriesId)) {
      console.log(`Verificando ${seriesId}...`)
      const result = await verifySeries(seriesId)
      results.push(result)
      
      if (result.match) {
        console.log(`  ✅ ${seriesId}: Datos coinciden`)
        console.log(`     BD: ${result.dbLatestDate} = ${result.dbLatestValue}`)
        console.log(`     API: ${result.apiLatestDate} = ${result.apiLatestValue}\n`)
      } else {
        console.log(`  ⚠️  ${seriesId}: ${result.error || 'No coincide'}`)
        console.log(`     BD: ${result.dbLatestDate} = ${result.dbLatestValue}`)
        console.log(`     API: ${result.apiLatestDate} = ${result.apiLatestValue}\n`)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE VERIFICACIÓN')
  console.log('='.repeat(60))
  
  const matched = results.filter(r => r.match).length
  const mismatched = results.filter(r => !r.match).length
  
  console.log(`✅ Series que coinciden: ${matched}/${results.length}`)
  console.log(`⚠️  Series con diferencias: ${mismatched}/${results.length}\n`)

  if (mismatched > 0) {
    console.log('Series que necesitan actualización:')
    results.filter(r => !r.match).forEach(r => {
      console.log(`  - ${r.seriesId}: ${r.error}`)
      console.log(`    BD: ${r.dbLatestDate} = ${r.dbLatestValue}`)
      console.log(`    API: ${r.apiLatestDate} = ${r.apiLatestValue}`)
    })
  }

  // Check dates
  console.log('\n📅 Fechas más recientes en BD:')
  const latestDates = db
    .prepare(`
      SELECT series_id, MAX(date) as latest_date 
      FROM macro_observations 
      GROUP BY series_id 
      ORDER BY latest_date DESC 
      LIMIT 10
    `)
    .all() as Array<{ series_id: string; latest_date: string }>
  
  latestDates.forEach(row => {
    const daysAgo = Math.floor((new Date(TODAY).getTime() - new Date(row.latest_date).getTime()) / (1000 * 60 * 60 * 24))
    const status = daysAgo <= 7 ? '✅' : daysAgo <= 30 ? '⚠️' : '❌'
    console.log(`  ${status} ${row.series_id}: ${row.latest_date} (${daysAgo} días atrás)`)
  })
}

main().catch(console.error)
