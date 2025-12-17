/**
 * Script to ensure SX5E and WTI exist in asset_metadata with correct category
 * 
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/ensure-sx5e-wti.ts
 */

import { getUnifiedDB } from '@/lib/db/unified-db'

const ASSETS_TO_ENSURE = [
  {
    symbol: 'SX5E',
    name: 'SX5E',
    category: 'index',
    yahoo_symbol: '^STOXX50E',
  },
  {
    symbol: 'WTI',
    name: 'WTI',
    category: 'commodity',
    yahoo_symbol: 'CL=F',
  },
]

async function main() {
  console.log('🔧 Ensuring SX5E and WTI exist with correct category...\n')
  
  const db = getUnifiedDB()
  
  for (const asset of ASSETS_TO_ENSURE) {
    // Check if exists
    const existing = await db.prepare(
      `SELECT symbol, category FROM asset_metadata WHERE symbol = ?`
    ).get(asset.symbol) as { symbol: string; category: string } | undefined
    
    if (existing) {
      // Update category if needed
      if (existing.category !== asset.category) {
        await db.prepare(
          `UPDATE asset_metadata 
           SET category = ?, name = ?, yahoo_symbol = ?, last_updated = datetime('now')
           WHERE symbol = ?`
        ).run(asset.category, asset.name, asset.yahoo_symbol, asset.symbol)
        console.log(`   ✅ Updated: ${asset.symbol} (category: ${existing.category} → ${asset.category})`)
      } else {
        console.log(`   ℹ️  Already exists: ${asset.symbol} (category: ${asset.category})`)
      }
    } else {
      // Create new
      await db.prepare(
        `INSERT INTO asset_metadata (symbol, name, category, yahoo_symbol, last_updated)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(asset.symbol, asset.name, asset.category, asset.yahoo_symbol)
      console.log(`   ➕ Created: ${asset.symbol} (category: ${asset.category})`)
    }
  }
  
  console.log('\n✨ Script completed!')
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
