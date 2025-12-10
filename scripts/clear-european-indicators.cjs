/**
 * Script para limpiar datos de indicadores europeos específicos
 * Uso: node scripts/clear-european-indicators.js
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

// Encontrar el archivo de base de datos
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'macro.db')

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Base de datos no encontrada en: ${dbPath}`)
  process.exit(1)
}

console.log(`📂 Usando base de datos: ${dbPath}\n`)

const db = new Database(dbPath)

function clearIndicatorData(seriesId) {
  console.log(`🗑️  Limpiando datos para: ${seriesId}`)
  
  try {
    const result = db.prepare(
      `DELETE FROM macro_observations WHERE series_id = ?`
    ).run(seriesId)
    console.log(`  ✅ Eliminadas ${result.changes} observaciones`)
    return result.changes
  } catch (error) {
    console.error(`  ❌ Error limpiando ${seriesId}:`, error.message)
    return 0
  }
}

function main() {
  console.log('🧹 Limpiando datos de indicadores europeos para forzar re-ingesta completa\n')
  
  const indicatorsToClear = [
    'EU_RETAIL_SALES_YOY',
    'EU_INDUSTRIAL_PRODUCTION_YOY',
  ]
  
  let totalDeleted = 0
  for (const indicatorId of indicatorsToClear) {
    const deleted = clearIndicatorData(indicatorId)
    totalDeleted += deleted
  }
  
  console.log(`\n✅ Limpieza completada: ${totalDeleted} observaciones eliminadas`)
  console.log('\n📋 Próximo paso: Ejecutar el job de ingesta europea:')
  console.log('   curl -X POST http://localhost:3000/api/jobs/ingest/european -H "Content-Type: application/json"')
  
  db.close()
}

main()

