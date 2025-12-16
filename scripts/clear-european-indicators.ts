/**
 * Script para limpiar datos de indicadores europeos específicos
 * Uso: npx tsx scripts/clear-european-indicators.ts
 */

import { config } from 'dotenv'
import { getDB } from '../lib/db/schema'
import { getUnifiedDB, isUsingTurso } from '../lib/db/unified-db'

config()

async function clearIndicatorData(seriesId: string) {
  console.log(`\n🗑️  Limpiando datos para: ${seriesId}`)
  
  try {
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      const result = await db.prepare(
        `DELETE FROM macro_observations WHERE series_id = ?`
      ).run(seriesId)
      console.log(`  ✅ Eliminadas ${result.changes || 0} observaciones (Turso)`)
    } else {
      const db = getDB()
      const result = db.prepare(
        `DELETE FROM macro_observations WHERE series_id = ?`
      ).run(seriesId)
      console.log(`  ✅ Eliminadas ${result.changes || 0} observaciones (SQLite)`)
    }
  } catch (error) {
    console.error(`  ❌ Error limpiando ${seriesId}:`, error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  console.log('🧹 Limpiando datos de indicadores europeos para forzar re-ingesta completa\n')
  
  const indicatorsToClear = [
    'EU_RETAIL_SALES_YOY',
    'EU_INDUSTRIAL_PRODUCTION_YOY',
  ]
  
  for (const indicatorId of indicatorsToClear) {
    await clearIndicatorData(indicatorId)
  }
  
  console.log('\n✅ Limpieza completada')
  console.log('\n📋 Próximo paso: Ejecutar el job de ingesta europea:')
  console.log('   curl -X POST http://localhost:3000/api/jobs/ingest/european -H "Content-Type: application/json"')
}

main().catch(console.error)









