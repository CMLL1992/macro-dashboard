/**
 * Script to generate universe.assets.json from assets.config.json and database
 * This ensures all assets are included in bias calculations and dashboard
 */

import fs from 'fs'
import path from 'path'
import type { AssetMeta } from '@/lib/bias/types'

// Map category to class
function categoryToClass(category: string): 'fx' | 'index' | 'metal' | 'crypto' | 'energy' {
  switch (category) {
    case 'forex':
      return 'fx'
    case 'index':
      return 'index'
    case 'metal':
      return 'metal'
    case 'crypto':
      return 'crypto'
    default:
      return 'fx'
  }
}

// Determine risk sensitivity based on asset
function getRiskSensitivity(symbol: string, category: string): 'risk_on' | 'risk_off' | 'neutral' {
  if (category === 'crypto') return 'risk_on'
  if (category === 'metal') return 'risk_off'
  if (category === 'index') {
    if (symbol === 'VIX') return 'risk_off'
    return 'risk_on'
  }
  // Forex
  if (symbol.includes('JPY') || symbol.includes('CHF')) return 'risk_off'
  if (symbol.includes('AUD') || symbol.includes('NZD') || symbol.includes('GBP')) return 'risk_on'
  return 'neutral'
}

// Determine USD exposure
function getUSDExposure(symbol: string, category: string): 'long_usd' | 'short_usd' | 'mixed' | 'none' {
  if (category === 'index') return 'none'
  if (category === 'crypto') return 'short_usd'
  if (category === 'metal') return 'short_usd'
  
  // Forex
  if (symbol.startsWith('USD')) {
    // USD is base, so long USD
    return 'long_usd'
  }
  if (symbol.endsWith('USD')) {
    // USD is quote, so short USD
    return 'short_usd'
  }
  return 'none'
}

// Extract base and quote from symbol
function extractBaseQuote(symbol: string, category: string): { base: string | null; quote: string | null } {
  if (category === 'index') {
    return { base: null, quote: null }
  }
  
  if (category === 'crypto') {
    if (symbol.endsWith('USDT')) {
      return { base: symbol.replace('USDT', ''), quote: 'USDT' }
    }
    return { base: null, quote: null }
  }
  
  // Forex: typically 6 characters (EURUSD)
  if (symbol.length === 6) {
    return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) }
  }
  
  // Metals
  if (symbol.startsWith('XAU') || symbol.startsWith('XAG') || symbol.startsWith('XPD') || symbol.startsWith('XPT')) {
    return { base: symbol.substring(0, 3), quote: 'USD' }
  }
  
  return { base: null, quote: null }
}

// Get region
function getRegion(symbol: string, category: string): string {
  if (category === 'crypto' || category === 'metal') return 'GLOBAL'
  if (category === 'index') {
    if (symbol === 'SPX' || symbol === 'NDX' || symbol === 'DJI' || symbol === 'RUT' || symbol === 'VIX') return 'US'
    if (symbol === 'DAX') return 'DE'
    if (symbol === 'FTSE') return 'UK'
    if (symbol === 'CAC') return 'FR'
    if (symbol === 'IBEX') return 'ES'
    if (symbol === 'N225') return 'JP'
    if (symbol === 'HSI') return 'HK'
    if (symbol === 'ASX') return 'AU'
    return 'GLOBAL'
  }
  
  // Forex regions
  if (symbol.includes('EUR')) return 'EA'
  if (symbol.includes('GBP')) return 'UK'
  if (symbol.includes('JPY')) return 'JP'
  if (symbol.includes('AUD')) return 'AU'
  if (symbol.includes('NZD')) return 'NZ'
  if (symbol.includes('CAD')) return 'CA'
  if (symbol.includes('CHF')) return 'CH'
  if (symbol.includes('USD')) return 'US'
  return 'GLOBAL'
}

async function generateUniverse() {
  try {
    // Load assets config
    const configPath = path.join(process.cwd(), 'config', 'assets.config.json')
    const configRaw = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configRaw)

    const universe: AssetMeta[] = []

    // Process forex
    for (const asset of config.forex || []) {
      const { base, quote } = extractBaseQuote(asset.symbol, 'forex')
      universe.push({
        symbol: asset.symbol,
        class: 'fx',
        base: base || null,
        quote: quote || null,
        risk_sensitivity: getRiskSensitivity(asset.symbol, 'forex'),
        usd_exposure: getUSDExposure(asset.symbol, 'forex'),
        region: getRegion(asset.symbol, 'forex'),
      })
    }

    // Process indices
    for (const asset of config.indices || []) {
      universe.push({
        symbol: asset.symbol,
        class: 'index',
        base: null,
        quote: null,
        risk_sensitivity: getRiskSensitivity(asset.symbol, 'index'),
        usd_exposure: 'none',
        region: getRegion(asset.symbol, 'index'),
      })
    }

    // Process metals
    for (const asset of config.metals || []) {
      const { base, quote } = extractBaseQuote(asset.symbol, 'metal')
      universe.push({
        symbol: asset.symbol,
        class: 'metal',
        base: base || null,
        quote: quote || null,
        risk_sensitivity: 'risk_off',
        usd_exposure: 'short_usd',
        region: 'GLOBAL',
      })
    }

    // Process crypto
    for (const asset of config.crypto || []) {
      const { base, quote } = extractBaseQuote(asset.symbol, 'crypto')
      universe.push({
        symbol: asset.symbol,
        class: 'crypto',
        base: base || null,
        quote: quote || null,
        risk_sensitivity: 'risk_on',
        usd_exposure: 'short_usd',
        region: 'GLOBAL',
      })
    }

    // Write universe file
    const universePath = path.join(process.cwd(), 'config', 'universe.assets.json')
    fs.writeFileSync(universePath, JSON.stringify(universe, null, 2), 'utf8')

    console.log(`✅ Generated universe.assets.json with ${universe.length} assets`)
    console.log(`   - Forex: ${config.forex?.length || 0}`)
    console.log(`   - Indices: ${config.indices?.length || 0}`)
    console.log(`   - Metals: ${config.metals?.length || 0}`)
    console.log(`   - Crypto: ${config.crypto?.length || 0}`)

    return universe
  } catch (error) {
    console.error('Error generating universe:', error)
    throw error
  }
}

// Run script
generateUniverse()
  .then(() => {
    console.log('✅ Universe generation completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error generating universe:', error)
    process.exit(1)
  })

export { generateUniverse }
