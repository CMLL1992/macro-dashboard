/**
 * Script to restore missing pairs that were incorrectly removed
 * 
 * Restores BTCUSD, ETHUSD, XAUUSD that should be in the dashboard
 * 
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/restore-missing-pairs.ts
 */

import { getUnifiedDB } from '@/lib/db/unified-db'

const PAIRS_TO_RESTORE = [
  {
    symbol: 'BTCUSD',
    name: 'BTC/USD',
    category: 'crypto',
    yahoo_symbol: 'BTC-USD',
  },
  {
    symbol: 'ETHUSD',
    name: 'ETH/USD',
    category: 'crypto',
    yahoo_symbol: 'ETH-USD',
  },
  {
    symbol: 'XAUUSD',
    name: 'XAU/USD',
    category: 'metal',
    yahoo_symbol: 'GC=F',
  },
]

async function main() {
  console.log('🔧 Restoring missing pairs...\n')
  
  const db = getUnifiedDB()
  
  for (const pair of PAIRS_TO_RESTORE) {
    // Check if exists
    const existing = await db.prepare(
      `SELECT symbol, category FROM asset_metadata WHERE symbol = ? OR symbol = ?`
    ).all(pair.symbol, pair.name) as Array<{ symbol: string; category: string }>
    
    if (existing.length > 0) {
      // Update category if needed
      const existingSymbol = existing[0].symbol
      const existingCategory = existing[0].category
      
      if (existingCategory !== pair.category) {
        await db.prepare(
          `UPDATE asset_metadata 
           SET category = ?, name = ?, yahoo_symbol = ?, last_updated = datetime('now')
           WHERE symbol = ?`
        ).run(pair.category, pair.name, pair.yahoo_symbol, existingSymbol)
        console.log(`   ✅ Updated: ${pair.symbol} (category: ${existingCategory} → ${pair.category})`)
      } else {
        console.log(`   ℹ️  Already exists: ${pair.symbol} (category: ${pair.category})`)
      }
    } else {
      // Create new
      await db.prepare(
        `INSERT INTO asset_metadata (symbol, name, category, yahoo_symbol, last_updated)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(pair.symbol, pair.name, pair.category, pair.yahoo_symbol)
      console.log(`   ➕ Created: ${pair.symbol} (category: ${pair.category})`)
    }
  }
  
  console.log('\n✨ Restoration completed!')
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
