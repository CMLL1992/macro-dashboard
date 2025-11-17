#!/usr/bin/env tsx
/**
 * Script directo para refrescar todos los datos del dashboard
 * Ejecuta ingesta FRED, correlaciones y cálculo de bias sin pasar por API HTTP
 */

// Cargar variables de entorno desde .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { fetchFredSeries } from '@/lib/fred'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { logger } from '@/lib/obs/logger'
import { upsertCorrelation } from '@/lib/db/upsert'
import { computeMacroBias } from '@/lib/bias/score'
import { buildBiasNarrative } from '@/lib/bias/explain'
import { upsertMacroBias } from '@/lib/db/upsert'
import universeAssets from '@/config/universe.assets.json'
import type { AssetMeta } from '@/lib/bias/types'
import { calculateCorrelation } from '@/lib/correlations/calc'
import { fetchDXYDaily, fetchAssetDaily, getActiveSymbols } from '@/lib/correlations/fetch'
import { setLastBiasUpdateTimestamp } from '@/lib/runtime/state'
import fs from 'node:fs'
import path from 'node:path'

// FRED series IDs used by the dashboard
const FRED_SERIES = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', frequency: 'm' },
  { id: 'CPILFESL', name: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy in U.S. City Average', frequency: 'm' },
  { id: 'PCEPI', name: 'Personal Consumption Expenditures: Chain-type Price Index', frequency: 'm' },
  { id: 'PCEPILFE', name: 'Personal Consumption Expenditures Excluding Food and Energy (Chain-Type Price Index)', frequency: 'm' },
  { id: 'PPIACO', name: 'Producer Price Index for All Commodities', frequency: 'm' },
  { id: 'GDPC1', name: 'Real Gross Domestic Product', frequency: 'q' },
  { id: 'INDPRO', name: 'Industrial Production Index', frequency: 'm' },
  { id: 'RSXFS', name: 'Advance Retail Sales: Retail Trade', frequency: 'm' },
  { id: 'PAYEMS', name: 'All Employees, Total Nonfarm', frequency: 'm' },
  { id: 'UNRATE', name: 'Unemployment Rate', frequency: 'm' },
  { id: 'ICSA', name: 'Initial Claims', frequency: 'w' },
  { id: 'T10Y2Y', name: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', frequency: 'd' },
  { id: 'FEDFUNDS', name: 'Effective Federal Funds Rate', frequency: 'm' },
  { id: 'VIXCLS', name: 'CBOE Volatility Index: VIX', frequency: 'd' },
]

async function ingestFred() {
  logger.info('Starting FRED data ingestion', { job: 'refresh_dashboard' })
  
  let ingested = 0
  let errors = 0

  for (const series of FRED_SERIES) {
    try {
      // No usar observation_end para obtener los datos más recientes disponibles
      const observations = await fetchFredSeries(series.id, {
        frequency: series.frequency as 'd' | 'm' | 'q',
        observation_start: '2010-01-01',
        // No especificar observation_end para obtener datos hasta la fecha más reciente disponible
      })

      if (observations.length === 0) {
        logger.warn(`No observations for ${series.id}`, { job: 'refresh_dashboard' })
        continue
      }

      const macroSeries: MacroSeries = {
        id: series.id,
        source: 'FRED',
        indicator: series.id,
        nativeId: series.id,
        name: series.name,
        frequency: series.frequency as any,
        data: observations.map(obs => ({
          date: obs.date,
          value: obs.value,
        })),
        lastUpdated: observations[observations.length - 1]?.date || undefined,
      }

      upsertMacroSeries(macroSeries)
      ingested++

      logger.info(`Ingested ${series.id}`, {
        job: 'refresh_dashboard',
        series_id: series.id,
        points: observations.length,
      })
    } catch (error) {
      errors++
      logger.error(`Failed to ingest ${series.id}`, {
        job: 'refresh_dashboard',
        series_id: series.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('FRED ingestion completed', {
    job: 'refresh_dashboard',
    ingested,
    errors,
  })

  return { ingested, errors }
}

// Load correlation config
function loadCorrelationConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'correlations.config.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {
      windows: {
        w12m: { trading_days: 252, min_obs: 150 },
        w3m: { trading_days: 63, min_obs: 40 },
      },
    }
  }
}

async function computeCorrelations() {
  logger.info('Starting correlations computation', { job: 'refresh_dashboard' })
  
  const CORR_CONFIG = loadCorrelationConfig()
  const today = new Date().toISOString().split('T')[0]
  
  // Fetch DXY data once
  const dxyPrices = await fetchDXYDaily()
  if (dxyPrices.length === 0) {
    throw new Error('Failed to fetch DXY data')
  }

  const activeSymbols = await getActiveSymbols()
  let computed = 0
  let errors = 0

  for (const symbol of activeSymbols) {
    try {
      const assetPrices = await fetchAssetDaily(symbol)
      if (assetPrices.length === 0) {
        logger.warn(`No asset data for ${symbol}, skipping correlation calculation`, {
          job: 'refresh_dashboard',
          symbol,
        })
        errors++
        // Store null correlations if no data
        upsertCorrelation({
          symbol,
          base: 'DXY',
          window: '12m',
          value: null,
          asof: today,
          n_obs: 0,
          last_asset_date: null,
          last_base_date: dxyPrices.length > 0 ? dxyPrices[dxyPrices.length - 1].date : null,
        })
        upsertCorrelation({
          symbol,
          base: 'DXY',
          window: '3m',
          value: null,
          asof: today,
          n_obs: 0,
          last_asset_date: null,
          last_base_date: dxyPrices.length > 0 ? dxyPrices[dxyPrices.length - 1].date : null,
        })
        continue
      }

      // Calculate 12m correlation
      const w12m = CORR_CONFIG.windows.w12m
      const corr12m = calculateCorrelation(assetPrices, dxyPrices, w12m.trading_days, w12m.min_obs)
      upsertCorrelation({
        symbol,
        base: 'DXY',
        window: '12m',
        value: corr12m.correlation,
        asof: today,
        n_obs: corr12m.n_obs,
        last_asset_date: corr12m.last_asset_date,
        last_base_date: corr12m.last_base_date,
      })

      // Calculate 3m correlation
      const w3m = CORR_CONFIG.windows.w3m
      const corr3m = calculateCorrelation(assetPrices, dxyPrices, w3m.trading_days, w3m.min_obs)
      upsertCorrelation({
        symbol,
        base: 'DXY',
        window: '3m',
        value: corr3m.correlation,
        asof: today,
        n_obs: corr3m.n_obs,
        last_asset_date: corr3m.last_asset_date,
        last_base_date: corr3m.last_base_date,
      })

      computed++
      logger.info(`Correlations calculated for ${symbol}`, {
        job: 'refresh_dashboard',
        symbol,
        corr12m: corr12m.correlation,
        n_obs12m: corr12m.n_obs,
        corr3m: corr3m.correlation,
        n_obs3m: corr3m.n_obs,
      })
    } catch (error) {
      errors++
      logger.error(`Failed to calculate correlations for ${symbol}`, {
        job: 'refresh_dashboard',
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('Correlations computation completed', {
    job: 'refresh_dashboard',
    computed,
    errors,
  })

  return { computed, errors }
}

async function computeBias() {
  logger.info('Starting bias computation', { job: 'refresh_dashboard' })
  
  const assets = universeAssets as AssetMeta[]
  let computed = 0
  let errors = 0

  for (const asset of assets) {
    try {
      const bias = await computeMacroBias(asset)
      const narrative = buildBiasNarrative(bias, asset)

      upsertMacroBias(bias, narrative)
      computed++

      logger.info(`Computed bias for ${asset.symbol}`, {
        job: 'refresh_dashboard',
        symbol: asset.symbol,
        score: bias.score,
        direction: bias.direction,
        confidence: bias.confidence,
      })
    } catch (error) {
      errors++
      logger.error(`Failed to compute bias for ${asset.symbol}`, {
        job: 'refresh_dashboard',
        symbol: asset.symbol,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Update timestamp
  setLastBiasUpdateTimestamp(new Date().toISOString())

  logger.info('Bias computation completed', {
    job: 'refresh_dashboard',
    computed,
    errors,
  })

  return { computed, errors }
}

async function main() {
  console.log('🔄 Refrescando datos del dashboard...\n')

  try {
    // Step 1: Ingest FRED data
    console.log('📊 Paso 1: Ingesta de datos FRED...')
    const fredResult = await ingestFred()
    console.log(`   ✅ ${fredResult.ingested} series ingeridas, ${fredResult.errors} errores\n`)

    // Step 2: Compute correlations
    console.log('🔗 Paso 2: Cálculo de correlaciones...')
    const corrResult = await computeCorrelations()
    console.log(`   ✅ ${corrResult.computed} correlaciones calculadas, ${corrResult.errors} errores\n`)

    // Step 3: Compute bias
    console.log('📈 Paso 3: Cálculo de bias macro...')
    const biasResult = await computeBias()
    console.log(`   ✅ ${biasResult.computed} bias calculados, ${biasResult.errors} errores\n`)

    console.log('✅ Dashboard refrescado correctamente!')
    console.log(`\n📊 Resumen:`)
    console.log(`   - Series FRED: ${fredResult.ingested}`)
    console.log(`   - Correlaciones: ${corrResult.computed}`)
    console.log(`   - Bias calculados: ${biasResult.computed}`)
  } catch (error) {
    console.error('❌ Error durante el refresh:', error)
    process.exit(1)
  }
}

main()


export {}
