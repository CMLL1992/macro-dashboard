/**
 * Script to clean up Forex pairs from database
 * 
 * Removes all Forex pairs that are NOT in FOREX_WHITELIST
 * Ensures only the 12 allowed Forex pairs exist in the database
 * 
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/cleanup-forex-pairs.ts
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { FOREX_WHITELIST } from '@/config/forex-whitelist'

async function main() {
  console.log('🧹 Starting Forex pairs cleanup...\n')
  
  const db = getUnifiedDB()
  const whitelistSet = new Set(FOREX_WHITELIST.map(s => s.toUpperCase()))
  
  console.log(`📋 Forex Whitelist (${FOREX_WHITELIST.length} pairs):`)
  FOREX_WHITELIST.forEach(pair => console.log(`   - ${pair}`))
  console.log('')
  
  // Step 1: Find all Forex pairs in asset_metadata
  // IMPORTANT: Only consider symbols that match Forex pattern (6 uppercase letters)
  // and are actually Forex pairs, not crypto/commodity/index misclassified
  const allForex = await db.prepare(
    `SELECT symbol, name, category FROM asset_metadata WHERE category = 'forex' ORDER BY symbol`
  ).all() as Array<{ symbol: string; name: string; category: string }>
  
  console.log(`📊 Found ${allForex.length} items with category='forex' in asset_metadata`)
  
  const toDelete: string[] = []
  const toKeep: string[] = []
  const toRecategorize: Array<{ symbol: string; newCategory: string }> = []
  
  for (const row of allForex) {
    const symbol = row.symbol.toUpperCase().replace('/', '')
    const isForexPattern = /^[A-Z]{6}$/.test(symbol)
    
    // Check if it's actually a Forex pair (6 letters pattern)
    if (!isForexPattern) {
      // Not a Forex pair - recategorize instead of delete
      let newCategory = 'forex'
      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        newCategory = 'crypto'
      } else if (symbol === 'COPPER' || symbol === 'WTI' || symbol === 'XAUUSD') {
        newCategory = 'commodity'
      } else if (symbol === 'SPX' || symbol === 'NDX' || symbol === 'SX5E' || symbol === 'NIKKEI') {
        newCategory = 'index'
      }
      toRecategorize.push({ symbol: row.symbol, newCategory })
      continue
    }
    
    // It's a Forex pattern - check whitelist
    if (whitelistSet.has(symbol)) {
      toKeep.push(row.symbol)
    } else {
      toDelete.push(row.symbol)
    }
  }
  
  console.log(`\n✅ To keep (${toKeep.length}):`)
  toKeep.forEach(s => console.log(`   - ${s}`))
  
  if (toRecategorize.length > 0) {
    console.log(`\n🔄 To recategorize (${toRecategorize.length}):`)
    toRecategorize.forEach(item => console.log(`   - ${item.symbol} → ${item.newCategory}`))
  }
  
  console.log(`\n❌ To delete (${toDelete.length}):`)
  toDelete.forEach(s => console.log(`   - ${s}`))
  
  if (toDelete.length === 0 && toRecategorize.length === 0) {
    console.log('\n✨ No Forex pairs to delete or recategorize. Database is already clean!')
    return
  }
  
  // Step 1.5: Recategorize non-Forex items
  if (toRecategorize.length > 0) {
    console.log('\n🔄 Recategorizing non-Forex items...')
    for (const item of toRecategorize) {
      await db.prepare(
        `UPDATE asset_metadata SET category = ? WHERE symbol = ?`
      ).run(item.newCategory, item.symbol)
    }
    console.log(`   ✅ Recategorized ${toRecategorize.length} items`)
  }
  
  // Step 2: Delete in cascading order
  console.log('\n🗑️  Deleting non-whitelisted Forex pairs...')
  
  let deletedPrices = 0
  let deletedCorrelations = 0
  let deletedCorrelationsHistory = 0
  let deletedBias = 0
  let deletedSignals = 0
  let deletedMetadata = 0
  
  for (const symbol of toDelete) {
    const normalizedSymbol = symbol.toUpperCase().replace('/', '')
    
    // Delete asset_prices
    const pricesResult = await db.prepare(
      `DELETE FROM asset_prices WHERE symbol = ?`
    ).run(symbol)
    deletedPrices += Number(pricesResult.changes) || 0
    
    // Delete correlations
    const corrResult = await db.prepare(
      `DELETE FROM correlations WHERE symbol = ?`
    ).run(symbol)
    deletedCorrelations += Number(corrResult.changes) || 0
    
    // Delete correlations_history
    const corrHistResult = await db.prepare(
      `DELETE FROM correlations_history WHERE symbol = ?`
    ).run(symbol)
    deletedCorrelationsHistory += Number(corrHistResult.changes) || 0
    
    // Delete macro_bias
    const biasResult = await db.prepare(
      `DELETE FROM macro_bias WHERE symbol = ?`
    ).run(symbol)
    deletedBias += Number(biasResult.changes) || 0
    
    // Delete pair_signals
    const signalsResult = await db.prepare(
      `DELETE FROM pair_signals WHERE symbol = ?`
    ).run(symbol)
    deletedSignals += Number(signalsResult.changes) || 0
    
    // Delete asset_metadata (last, as it may have foreign keys)
    const metadataResult = await db.prepare(
      `DELETE FROM asset_metadata WHERE symbol = ?`
    ).run(symbol)
    deletedMetadata += Number(metadataResult.changes) || 0
  }
  
  console.log('\n📊 Deletion summary:')
  console.log(`   - asset_prices: ${deletedPrices} rows`)
  console.log(`   - correlations: ${deletedCorrelations} rows`)
  console.log(`   - correlations_history: ${deletedCorrelationsHistory} rows`)
  console.log(`   - macro_bias: ${deletedBias} rows`)
  console.log(`   - pair_signals: ${deletedSignals} rows`)
  console.log(`   - asset_metadata: ${deletedMetadata} rows`)
  
  // Step 3: Verify final state
  const remainingForex = await db.prepare(
    `SELECT symbol FROM asset_metadata WHERE category = 'forex' ORDER BY symbol`
  ).all() as Array<{ symbol: string }>
  
  console.log(`\n✅ Verification: ${remainingForex.length} Forex pairs remaining`)
  remainingForex.forEach(row => {
    const symbol = row.symbol.toUpperCase().replace('/', '')
    const isWhitelisted = whitelistSet.has(symbol)
    console.log(`   ${isWhitelisted ? '✅' : '❌'} ${row.symbol}`)
  })
  
  const remainingSymbols = remainingForex.map(r => r.symbol.toUpperCase().replace('/', ''))
  const allWhitelisted = remainingSymbols.every(s => whitelistSet.has(s))
  const allPresent = FOREX_WHITELIST.every(s => remainingSymbols.includes(s))
  
  if (allWhitelisted && allPresent) {
    console.log('\n✨ SUCCESS: Database contains exactly the 12 whitelisted Forex pairs!')
  } else {
    console.log('\n⚠️  WARNING: Database state does not match whitelist exactly')
    if (!allWhitelisted) {
      const extra = remainingSymbols.filter(s => !whitelistSet.has(s))
      console.log(`   Extra pairs: ${extra.join(', ')}`)
    }
    if (!allPresent) {
      const missing = FOREX_WHITELIST.filter(s => !remainingSymbols.includes(s))
      console.log(`   Missing pairs: ${missing.join(', ')}`)
    }
  }
  
  console.log('\n🏁 Cleanup completed!')
}

main().catch(error => {
  console.error('❌ Error during cleanup:', error)
  process.exit(1)
})
