/**
 * Script para verificar que macro_bias tiene exactamente los 19 símbolos permitidos
 * 
 * Uso:
 *   pnpm tsx scripts/verificar-macro-bias.ts
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getAllowedPairs } from '@/config/tactical-pairs'

async function main() {
  console.log('🔍 Verificando símbolos en macro_bias...\n')

  try {
    // Obtener símbolos permitidos
    const allowedPairs = getAllowedPairs()
    console.log(`✅ Símbolos permitidos (${allowedPairs.length}):`, allowedPairs.sort().join(', '))
    console.log()

    // Consultar macro_bias
    const db = getUnifiedDB()
    const isTurso = isUsingTurso()

    let rows: Array<{ symbol: string }>
    if (isTurso) {
      rows = await db.prepare('SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol').all() as Array<{ symbol: string }>
    } else {
      const { getDB } = await import('@/lib/db/schema')
      const sqliteDb = getDB()
      rows = sqliteDb.prepare('SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol').all() as Array<{ symbol: string }>
    }

    const symbolsInDb = rows.map(r => r.symbol.toUpperCase()).sort()
    const allowedSet = new Set(allowedPairs.map(s => s.toUpperCase()))

    console.log(`📊 Símbolos en macro_bias (${symbolsInDb.length}):`, symbolsInDb.join(', '))
    console.log()

    // Verificar
    const extraSymbols = symbolsInDb.filter(s => !allowedSet.has(s))
    const missingSymbols = allowedPairs.filter(s => !symbolsInDb.includes(s.toUpperCase()))

    if (extraSymbols.length === 0 && missingSymbols.length === 0 && symbolsInDb.length === allowedPairs.length) {
      console.log('✅ VERIFICACIÓN EXITOSA')
      console.log(`   - Total en BD: ${symbolsInDb.length}`)
      console.log(`   - Total permitidos: ${allowedPairs.length}`)
      console.log(`   - Coinciden perfectamente`)
      process.exit(0)
    } else {
      console.log('⚠️  VERIFICACIÓN FALLIDA')
      if (extraSymbols.length > 0) {
        console.log(`   ❌ Símbolos extra en BD (${extraSymbols.length}):`, extraSymbols.join(', '))
      }
      if (missingSymbols.length > 0) {
        console.log(`   ❌ Símbolos faltantes (${missingSymbols.length}):`, missingSymbols.join(', '))
      }
      if (symbolsInDb.length !== allowedPairs.length) {
        console.log(`   ❌ Conteo incorrecto: BD tiene ${symbolsInDb.length}, debería tener ${allowedPairs.length}`)
      }
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error al verificar:', error)
    process.exit(1)
  }
}

main()
