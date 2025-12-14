#!/usr/bin/env tsx
/**
 * Script de prueba de conexión a la base de datos
 * Verifica que Turso o SQLite funcionan correctamente
 */

// Cargar variables de entorno desde .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { getUnifiedDB, isUsingTurso, initializeSchemaUnified } from '../lib/db/unified-db'

async function testDatabase() {
  console.log('🔍 Verificando conexión a la base de datos...\n')

  // Verificar configuración
  const usingTurso = isUsingTurso()
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const hasToken = !!process.env.TURSO_AUTH_TOKEN

  console.log('📋 Configuración:')
  console.log(`   - Usando Turso: ${usingTurso ? '✅ Sí' : '❌ No (usando SQLite local)'}`)
  if (usingTurso) {
    console.log(`   - TURSO_DATABASE_URL: ${tursoUrl ? '✅ Configurado' : '❌ No configurado'}`)
    console.log(`   - TURSO_AUTH_TOKEN: ${hasToken ? '✅ Configurado' : '❌ No configurado'}`)
  } else {
    console.log(`   - Base de datos local: macro.db`)
  }
  console.log()

  try {
    // Inicializar esquema si es necesario
    console.log('🔧 Inicializando esquema...')
    await initializeSchemaUnified()
    console.log('✅ Esquema inicializado correctamente\n')

    // Obtener conexión
    const db = getUnifiedDB()

    // Prueba 1: SELECT 1
    console.log('🧪 Prueba 1: SELECT 1')
    const result1 = await db.prepare('SELECT 1 as test').get()
    console.log(`   ✅ Resultado: ${JSON.stringify(result1)}\n`)

    // Prueba 2: Verificar tablas existentes
    console.log('🧪 Prueba 2: Verificar tablas existentes')
    let tables: any[] = []
    if (usingTurso) {
      // Turso usa SQLite, pero la query puede variar
      const tablesResult = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all()
      tables = tablesResult as any[]
    } else {
      const tablesResult = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all()
      tables = tablesResult as any[]
    }
    console.log(`   ✅ Tablas encontradas: ${tables.length}`)
    if (tables.length > 0) {
      console.log(`   📋 Primeras 5 tablas: ${tables.slice(0, 5).map((t: any) => t.name).join(', ')}`)
    }
    console.log()

    // Prueba 3: Contar registros en tablas clave
    console.log('🧪 Prueba 3: Contar registros en tablas clave')
    const tablesToCheck = [
      'macro_series',
      'macro_observations',
      'macro_bias',
      'correlations',
      'indicator_history',
    ]

    for (const tableName of tablesToCheck) {
      try {
        const countResult = await db.prepare(`SELECT COUNT(1) as c FROM ${tableName}`).get() as { c: number } | undefined
        const count = countResult?.c || 0
        console.log(`   ✅ ${tableName}: ${count} registros`)
      } catch (error: any) {
        console.log(`   ⚠️  ${tableName}: Error - ${error.message}`)
      }
    }
    console.log()

    // Prueba 4: Verificar última actualización
    console.log('🧪 Prueba 4: Verificar última actualización')
    try {
      const latestObs = await db.prepare(
        'SELECT MAX(date) as latest_date FROM macro_observations'
      ).get() as { latest_date: string | null } | undefined
      const latestDate = latestObs?.latest_date || null
      if (latestDate) {
        console.log(`   ✅ Última observación: ${latestDate}`)
      } else {
        console.log(`   ⚠️  No hay observaciones en la base de datos`)
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error al obtener última actualización: ${error.message}`)
    }
    console.log()

    console.log('✅ Todas las pruebas completadas exitosamente')
    console.log('\n🎉 La base de datos está funcionando correctamente!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error al conectar con la base de datos:')
    console.error(`   Mensaje: ${error.message}`)
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`)
    }
    console.error('\n💡 Sugerencias:')
    if (usingTurso) {
      console.error('   - Verifica que TURSO_DATABASE_URL y TURSO_AUTH_TOKEN estén configurados en .env.local')
      console.error('   - Verifica que el token de Turso sea válido')
      console.error('   - Verifica tu conexión a internet')
    } else {
      console.error('   - Verifica que el archivo macro.db tenga permisos de lectura/escritura')
      console.error('   - Verifica que el directorio actual tenga permisos de escritura')
    }
    process.exit(1)
  }
}

testDatabase()


