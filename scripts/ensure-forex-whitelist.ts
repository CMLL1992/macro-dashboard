/**
 * Script to ensure all Forex whitelist pairs exist in asset_metadata
 * 
 * Creates/updates asset_metadata entries for all 12 whitelisted Forex pairs
 * 
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/ensure-forex-whitelist.ts
 */

import { getUnifiedDB } from '@/lib/db/unified-db'
import { FOREX_WHITELIST, toDisplayFormat } from '@/config/forex-whitelist'

// Yahoo Finance symbols mapping
const YAHOO_SYMBOLS: Record<string, string> = {
  'EURUSD': 'EURUSD=X',
  'GBPUSD': 'GBPUSD=X',
  'USDJPY': 'USDJPY=X',
  'USDCHF': 'USDCHF=X',
  'AUDUSD': 'AUDUSD=X',
  'USDCAD': 'USDCAD=X',
  'NZDUSD': 'NZDUSD=X',
  'EURGBP': 'EURGBP=X',
  'EURJPY': 'EURJPY=X',
  'GBPJPY': 'GBPJPY=X',
  'EURCHF': 'EURCHF=X',
  'AUDJPY': 'AUDJPY=X',
}

async function main() {
  console.log('🔧 Ensuring Forex whitelist pairs exist in database...\n')
  
  const db = getUnifiedDB()
  
  console.log(`📋 Processing ${FOREX_WHITELIST.length} Forex pairs:\n`)
  
  let created = 0
  let updated = 0
  let skipped = 0
  
  for (const symbol of FOREX_WHITELIST) {
    const displaySymbol = toDisplayFormat(symbol)
    const yahooSymbol = YAHOO_SYMBOLS[symbol] || `${symbol}=X`
    
    // Check if exists
    const existing = await db.prepare(
      `SELECT symbol FROM asset_metadata WHERE symbol = ? OR symbol = ?`
    ).all(symbol, displaySymbol) as Array<{ symbol: string }>
    
    if (existing.length > 0) {
      // Update if needed
      const existingSymbol = existing[0].symbol
      await db.prepare(
        `UPDATE asset_metadata 
         SET name = ?, category = 'forex', yahoo_symbol = ?, last_updated = datetime('now')
         WHERE symbol = ?`
      ).run(displaySymbol, yahooSymbol, existingSymbol)
      updated++
      console.log(`   ✅ Updated: ${displaySymbol}`)
    } else {
      // Create new
      await db.prepare(
        `INSERT INTO asset_metadata (symbol, name, category, yahoo_symbol, last_updated)
         VALUES (?, ?, 'forex', ?, datetime('now'))`
      ).run(symbol, displaySymbol, yahooSymbol)
      created++
      console.log(`   ➕ Created: ${displaySymbol}`)
    }
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`   - Created: ${created}`)
  console.log(`   - Updated: ${updated}`)
  console.log(`   - Skipped: ${skipped}`)
  
  // Verify all pairs exist
  const allForex = await db.prepare(
    `SELECT symbol FROM asset_metadata WHERE category = 'forex' ORDER BY symbol`
  ).all() as Array<{ symbol: string }>
  
  const existingSymbols = new Set(
    allForex.map(r => r.symbol.toUpperCase().replace('/', ''))
  )
  
  const allPresent = FOREX_WHITELIST.every(s => existingSymbols.has(s))
  
  if (allPresent) {
    console.log(`\n✨ SUCCESS: All ${FOREX_WHITELIST.length} whitelisted Forex pairs exist in database!`)
  } else {
    const missing = FOREX_WHITELIST.filter(s => !existingSymbols.has(s))
    console.log(`\n⚠️  WARNING: Missing pairs: ${missing.join(', ')}`)
  }
  
  console.log('\n🏁 Script completed!')
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
