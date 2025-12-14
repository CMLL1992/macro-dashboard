/**
 * Script para verificar la configuración de Turso
 * Compara las variables de entorno locales con las de Vercel
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

console.log('=== Verificación de Configuración Turso ===\n')

// Leer .env.local si existe
const envLocalPath = join(process.cwd(), '.env.local')
let localTursoUrl: string | null = null
let localTursoToken: string | null = null

if (existsSync(envLocalPath)) {
  const envLocal = readFileSync(envLocalPath, 'utf-8')
  const urlMatch = envLocal.match(/TURSO_DATABASE_URL=(.+)/)
  const tokenMatch = envLocal.match(/TURSO_AUTH_TOKEN=(.+)/)
  
  if (urlMatch) {
    localTursoUrl = urlMatch[1].trim()
  }
  if (tokenMatch) {
    localTursoToken = tokenMatch[1].trim()
  }
}

// Leer VALORES-TURSO.md
const valoresPath = join(process.cwd(), 'VALORES-TURSO.md')
let vercelTursoUrl: string | null = null
let vercelTursoToken: string | null = null

if (existsSync(valoresPath)) {
  const valores = readFileSync(valoresPath, 'utf-8')
  const urlMatch = valores.match(/libsql:\/\/[^\s`]+/)
  const tokenMatch = valores.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)
  
  if (urlMatch) {
    vercelTursoUrl = urlMatch[0]
  }
  if (tokenMatch) {
    vercelTursoToken = tokenMatch[0]
  }
}

console.log('📋 Configuración Local (.env.local):')
console.log(`  TURSO_DATABASE_URL: ${localTursoUrl || '❌ NO CONFIGURADO'}`)
console.log(`  TURSO_AUTH_TOKEN: ${localTursoToken ? '✅ Configurado (' + localTursoToken.length + ' chars)' : '❌ NO CONFIGURADO'}`)
console.log('')

console.log('📋 Configuración Vercel (VALORES-TURSO.md):')
console.log(`  TURSO_DATABASE_URL: ${vercelTursoUrl || '❌ NO ENCONTRADO'}`)
console.log(`  TURSO_AUTH_TOKEN: ${vercelTursoToken ? '✅ Encontrado (' + vercelTursoToken.length + ' chars)' : '❌ NO ENCONTRADO'}`)
console.log('')

// Comparar
if (localTursoUrl && vercelTursoUrl) {
  if (localTursoUrl === vercelTursoUrl) {
    console.log('✅ Las URLs de Turso coinciden')
  } else {
    console.log('⚠️  Las URLs de Turso NO coinciden:')
    console.log(`   Local:  ${localTursoUrl}`)
    console.log(`   Vercel: ${vercelTursoUrl}`)
  }
} else {
  console.log('⚠️  No se pueden comparar URLs (falta configuración)')
}

if (localTursoToken && vercelTursoToken) {
  if (localTursoToken === vercelTursoToken) {
    console.log('✅ Los tokens de Turso coinciden')
  } else {
    console.log('⚠️  Los tokens de Turso NO coinciden (longitudes diferentes)')
  }
} else {
  console.log('⚠️  No se pueden comparar tokens (falta configuración)')
}

console.log('')
console.log('💡 Para alinear las configuraciones:')
if (!localTursoUrl || !localTursoToken) {
  console.log('  1. Crea/edita .env.local con:')
  if (vercelTursoUrl) {
    console.log(`     TURSO_DATABASE_URL=${vercelTursoUrl}`)
  }
  if (vercelTursoToken) {
    console.log(`     TURSO_AUTH_TOKEN=${vercelTursoToken}`)
  }
}
console.log('  2. Reinicia el servidor de desarrollo')
console.log('  3. Verifica los logs al iniciar para confirmar qué BD se está usando')

















