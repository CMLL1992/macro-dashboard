/**
 * Script para analizar cobertura de indicadores por moneda
 * Verifica qué indicadores del currency-indicators.json tienen datos reales en la BD
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env.local' })

interface CurrencyIndicator {
  currency: string
  group: string
}

interface IndicatorCoverage {
  series_id: string
  currency: string
  group: string
  last_date: string | null
  n_30d: number
  n_90d: number
  n_365d: number
  total_count: number
  status: 'OK' | 'STALE_OR_EMPTY' | 'MISSING_IN_DB'
}

interface CurrencySummary {
  currency: string
  total_indicators: number
  indicators_in_db: number
  indicators_with_recent_data: number
  newest_date: string | null
  by_group: Record<string, { total: number; with_data: number; with_recent: number }>
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL
  const dbToken = process.env.TURSO_AUTH_TOKEN

  if (!dbUrl || !dbToken) {
    console.error('❌ TURSO_DATABASE_URL y TURSO_AUTH_TOKEN deben estar configurados')
    process.exit(1)
  }

  const client = createClient({
    url: dbUrl,
    authToken: dbToken,
  })

  // Cargar currency-indicators.json
  const configPath = join(process.cwd(), 'config', 'currency-indicators.json')
  const configData = JSON.parse(readFileSync(configPath, 'utf8'))
  const indicators: Record<string, CurrencyIndicator> = configData.indicators

  console.log('📊 Analizando cobertura de indicadores por moneda...\n')

  // Obtener todos los series_id del config
  const wantedSeriesIds = Object.keys(indicators)

  // Query para obtener cobertura de cada indicador
  const coverageResults: IndicatorCoverage[] = []

  for (const seriesId of wantedSeriesIds) {
    try {
      // Obtener último dato y conteos
      const result = await client.execute({
        sql: `
          SELECT
            series_id,
            MAX(date) AS last_date,
            COUNT(*) FILTER (WHERE date >= date('now', '-30 days')) AS n_30d,
            COUNT(*) FILTER (WHERE date >= date('now', '-90 days')) AS n_90d,
            COUNT(*) FILTER (WHERE date >= date('now', '-365 days')) AS n_365d,
            COUNT(*) AS total_count
          FROM macro_observations
          WHERE series_id = ? AND value IS NOT NULL
          GROUP BY series_id
        `,
        args: [seriesId],
      })

      const row = result.rows[0]
      const indicator = indicators[seriesId]

      if (row) {
        const n_30d = Number(row.n_30d) || 0
        const n_90d = Number(row.n_90d) || 0
        const n_365d = Number(row.n_365d) || 0
        const total_count = Number(row.total_count) || 0
        const last_date = row.last_date as string | null

        let status: IndicatorCoverage['status'] = 'OK'
        if (total_count === 0) {
          status = 'MISSING_IN_DB'
        } else if (n_90d === 0) {
          status = 'STALE_OR_EMPTY'
        }

        coverageResults.push({
          series_id: seriesId,
          currency: indicator.currency,
          group: indicator.group,
          last_date,
          n_30d,
          n_90d,
          n_365d,
          total_count,
          status,
        })
      } else {
        // No hay datos en BD
        coverageResults.push({
          series_id: seriesId,
          currency: indicator.currency,
          group: indicator.group,
          last_date: null,
          n_30d: 0,
          n_90d: 0,
          n_365d: 0,
          total_count: 0,
          status: 'MISSING_IN_DB',
        })
      }
    } catch (error) {
      console.error(`Error procesando ${seriesId}:`, error)
    }
  }

  // Agrupar por moneda
  const currencySummaries: Record<string, CurrencySummary> = {}

  for (const result of coverageResults) {
    const { currency, group } = result

    if (!currencySummaries[currency]) {
      currencySummaries[currency] = {
        currency,
        total_indicators: 0,
        indicators_in_db: 0,
        indicators_with_recent_data: 0,
        newest_date: null,
        by_group: {},
      }
    }

    const summary = currencySummaries[currency]
    summary.total_indicators++

    if (result.status !== 'MISSING_IN_DB') {
      summary.indicators_in_db++
    }

    if (result.status === 'OK') {
      summary.indicators_with_recent_data++
    }

    if (result.last_date) {
      if (!summary.newest_date || result.last_date > summary.newest_date) {
        summary.newest_date = result.last_date
      }
    }

    // Por grupo
    if (!summary.by_group[group]) {
      summary.by_group[group] = {
        total: 0,
        with_data: 0,
        with_recent: 0,
      }
    }

    const groupStats = summary.by_group[group]
    groupStats.total++

    if (result.status !== 'MISSING_IN_DB') {
      groupStats.with_data++
    }

    if (result.status === 'OK') {
      groupStats.with_recent++
    }
  }

  // Imprimir reporte
  console.log('='.repeat(80))
  console.log('📈 RESUMEN POR MONEDA')
  console.log('='.repeat(80))
  console.log()

  for (const [currency, summary] of Object.entries(currencySummaries).sort()) {
    const coverage_pct = ((summary.indicators_with_recent_data / summary.total_indicators) * 100).toFixed(1)
    const data_pct = ((summary.indicators_in_db / summary.total_indicators) * 100).toFixed(1)

    console.log(`\n💰 ${currency}`)
    console.log(`   Total mapeados: ${summary.total_indicators}`)
    console.log(`   Con datos en BD: ${summary.indicators_in_db} (${data_pct}%)`)
    console.log(`   Con datos recientes (90d): ${summary.indicators_with_recent_data} (${coverage_pct}%)`)
    console.log(`   Última fecha: ${summary.newest_date || 'N/A'}`)

    console.log(`   Por grupo:`)
    for (const [group, stats] of Object.entries(summary.by_group).sort()) {
      const group_coverage = ((stats.with_recent / stats.total) * 100).toFixed(0)
      console.log(
        `     ${group.padEnd(12)}: ${stats.with_recent}/${stats.total} recientes (${group_coverage}%) | ${stats.with_data}/${stats.total} con datos`
      )
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📋 DETALLE POR INDICADOR (solo problemas)')
  console.log('='.repeat(80))
  console.log()

  // Mostrar solo indicadores con problemas
  const problematic = coverageResults.filter((r) => r.status !== 'OK').sort((a, b) => {
    // Ordenar por: moneda, luego por status
    if (a.currency !== b.currency) return a.currency.localeCompare(b.currency)
    if (a.status !== b.status) {
      const statusOrder = { MISSING_IN_DB: 0, STALE_OR_EMPTY: 1, OK: 2 }
      return statusOrder[a.status] - statusOrder[b.status]
    }
    return a.series_id.localeCompare(b.series_id)
  })

  if (problematic.length === 0) {
    console.log('✅ Todos los indicadores tienen datos recientes')
  } else {
    for (const result of problematic) {
      const statusIcon = result.status === 'MISSING_IN_DB' ? '❌' : '⚠️'
      console.log(
        `${statusIcon} ${result.currency.padEnd(3)} | ${result.group.padEnd(12)} | ${result.series_id.padEnd(35)} | ${result.status.padEnd(18)} | último: ${result.last_date || 'N/A'} | total: ${result.total_count}`
      )
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(80))
  console.log('🎯 DIAGNÓSTICO Y RECOMENDACIONES')
  console.log('='.repeat(80))
  console.log()

  for (const [currency, summary] of Object.entries(currencySummaries).sort()) {
    const coverage_pct = (summary.indicators_with_recent_data / summary.total_indicators) * 100

    if (coverage_pct < 50) {
      console.log(`🔴 ${currency}: Cobertura crítica (${coverage_pct.toFixed(1)}%)`)
      if (summary.indicators_in_db === 0) {
        console.log(`   → No hay datos en BD. Revisar ingesta o remover ${currency} del cálculo.`)
      } else if (summary.indicators_with_recent_data === 0) {
        console.log(`   → Hay datos pero están obsoletos. Revisar pipeline de actualización.`)
      } else {
        console.log(`   → Faltan indicadores con datos recientes. Revisar mapeo o ingesta.`)
      }
    } else if (coverage_pct < 80) {
      console.log(`⚠️  ${currency}: Cobertura baja (${coverage_pct.toFixed(1)}%)`)
      console.log(`   → Considerar añadir más indicadores o mejorar ingesta.`)
    } else {
      console.log(`✅ ${currency}: Cobertura buena (${coverage_pct.toFixed(1)}%)`)
    }
  }

  // Verificar grupos faltantes
  console.log('\n📊 Grupos faltantes por moneda:')
  for (const [currency, summary] of Object.entries(currencySummaries).sort()) {
    const expectedGroups = ['inflation', 'growth', 'labor', 'monetary', 'sentiment']
    const missingGroups = expectedGroups.filter((g) => !summary.by_group[g] || summary.by_group[g].with_recent === 0)

    if (missingGroups.length > 0) {
      console.log(`   ${currency}: faltan ${missingGroups.join(', ')}`)
    }
  }

  await client.close()
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
