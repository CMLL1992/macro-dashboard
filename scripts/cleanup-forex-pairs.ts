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
  const allForex = await db.execute({
    sql: `SELECT symbol, name, category FROM asset_metadata WHERE category = 'forex' ORDER BY symbol`
  })
  
  console.log(`📊 Found ${allForex.rows.length} Forex pairs in asset_metadata`)
  
  const toDelete: string[] = []
  const toKeep: string[] = []
  
  for (const row of allForex.rows) {
    const symbol = (row.symbol as string).toUpperCase().replace('/', '')
    if (whitelistSet.has(symbol)) {
      toKeep.push(row.symbol as string)
    } else {
      toDelete.push(row.symbol as string)
    }
  }
  
  console.log(`\n✅ To keep (${toKeep.length}):`)
  toKeep.forEach(s => console.log(`   - ${s}`))
  
  console.log(`\n❌ To delete (${toDelete.length}):`)
  toDelete.forEach(s => console.log(`   - ${s}`))
  
  if (toDelete.length === 0) {
    console.log('\n✨ No Forex pairs to delete. Database is already clean!')
    return
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
    const pricesResult = await db.execute({
      sql: `DELETE FROM asset_prices WHERE symbol = ?`,
      args: [symbol]
    })
    deletedPrices += pricesResult.rowsAffected || 0
    
    // Delete correlations
    const corrResult = await db.execute({
      sql: `DELETE FROM correlations WHERE symbol = ?`,
      args: [symbol]
    })
    deletedCorrelations += corrResult.rowsAffected || 0
    
    // Delete correlations_history
    const corrHistResult = await db.execute({
      sql: `DELETE FROM correlations_history WHERE symbol = ?`,
      args: [symbol]
    })
    deletedCorrelationsHistory += corrHistResult.rowsAffected || 0
    
    // Delete macro_bias
    const biasResult = await db.execute({
      sql: `DELETE FROM macro_bias WHERE symbol = ?`,
      args: [symbol]
    })
    deletedBias += biasResult.rowsAffected || 0
    
    // Delete pair_signals
    const signalsResult = await db.execute({
      sql: `DELETE FROM pair_signals WHERE symbol = ?`,
      args: [symbol]
    })
    deletedSignals += signalsResult.rowsAffected || 0
    
    // Delete asset_metadata (last, as it may have foreign keys)
    const metadataResult = await db.execute({
      sql: `DELETE FROM asset_metadata WHERE symbol = ?`,
      args: [symbol]
    })
    deletedMetadata += metadataResult.rowsAffected || 0
  }
  
  console.log('\n📊 Deletion summary:')
  console.log(`   - asset_prices: ${deletedPrices} rows`)
  console.log(`   - correlations: ${deletedCorrelations} rows`)
  console.log(`   - correlations_history: ${deletedCorrelationsHistory} rows`)
  console.log(`   - macro_bias: ${deletedBias} rows`)
  console.log(`   - pair_signals: ${deletedSignals} rows`)
  console.log(`   - asset_metadata: ${deletedMetadata} rows`)
  
  // Step 3: Verify final state
  const remainingForex = await db.execute({
    sql: `SELECT symbol FROM asset_metadata WHERE category = 'forex' ORDER BY symbol`
  })
  
  console.log(`\n✅ Verification: ${remainingForex.rows.length} Forex pairs remaining`)
  remainingForex.rows.forEach(row => {
    const symbol = (row.symbol as string).toUpperCase().replace('/', '')
    const isWhitelisted = whitelistSet.has(symbol)
    console.log(`   ${isWhitelisted ? '✅' : '❌'} ${row.symbol}`)
  })
  
  const remainingSymbols = remainingForex.rows.map(r => (r.symbol as string).toUpperCase().replace('/', ''))
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
