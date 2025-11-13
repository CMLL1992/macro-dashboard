/**
 * Script para actualizar todos los datos hasta la fecha actual
 * 
 * Actualiza:
 * - Datos FRED (indicadores macroeconómicos)
 * - Correlaciones
 * - Bias macro
 * - Noticias desde RSS
 * - Calendario desde FRED
 * 
 * Uso:
 *   APP_URL=https://macro-dashboard-seven.vercel.app \
 *   CRON_TOKEN=tu_token \
 *   INGEST_KEY=tu_key \
 *   FRED_API_KEY=tu_fred_key \
 *   pnpm tsx scripts/update-all-data.ts
 */

const APP_URL = process.env.APP_URL || 'https://macro-dashboard-seven.vercel.app'
const CRON_TOKEN = process.env.CRON_TOKEN || ''
const INGEST_KEY = process.env.INGEST_KEY || ''
const FRED_API_KEY = process.env.FRED_API_KEY || ''

async function callAPI(endpoint: string, method: string = 'POST', headers: Record<string, string> = {}, body?: any) {
  try {
    const response = await fetch(`${APP_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API returned ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error calling ${endpoint}:`, error)
    throw error
  }
}

async function updateFredData() {
  console.log('\n📊 Actualizando datos FRED...')
  try {
    const result = await callAPI('/api/jobs/ingest/fred', 'POST', {
      'Authorization': `Bearer ${CRON_TOKEN}`,
    })
    console.log(`✅ Datos FRED actualizados: ${result.updatedSeriesCount || 0} series`)
    return result
  } catch (error) {
    console.error('❌ Error actualizando datos FRED:', error)
    return null
  }
}

async function updateCorrelations() {
  console.log('\n🔗 Calculando correlaciones...')
  try {
    const result = await callAPI('/api/jobs/correlations', 'POST', {
      'Authorization': `Bearer ${CRON_TOKEN}`,
    })
    console.log(`✅ Correlaciones calculadas: ${result.updatedPairsCount || 0} pares`)
    return result
  } catch (error) {
    console.error('❌ Error calculando correlaciones:', error)
    return null
  }
}

async function updateBias() {
  console.log('\n📈 Calculando bias macro...')
  try {
    const result = await callAPI('/api/jobs/compute/bias', 'POST', {
      'Authorization': `Bearer ${CRON_TOKEN}`,
    })
    console.log('✅ Bias macro calculado')
    return result
  } catch (error) {
    console.error('❌ Error calculando bias:', error)
    return null
  }
}

async function updateNews() {
  console.log('\n📰 Actualizando noticias desde RSS...')
  try {
    // Importar y ejecutar el script de noticias
    const { ingestNewsFromRSS } = await import('./ingest-news-rss.js')
    const result = await ingestNewsFromRSS()
    console.log(`✅ Noticias actualizadas: ${result.inserted || 0} insertadas, ${result.skipped || 0} omitidas`)
    return result
  } catch (error) {
    console.error('❌ Error actualizando noticias:', error)
    return null
  }
}

async function updateCalendar() {
  console.log('\n📅 Actualizando calendario desde FRED...')
  try {
    // Importar y ejecutar el script de calendario
    const { ingestCalendarFromFRED } = await import('./ingest-calendar-fred.js')
    const result = await ingestCalendarFromFRED()
    console.log(`✅ Calendario actualizado: ${result.inserted || 0} eventos insertados, ${result.skipped || 0} omitidos`)
    return result
  } catch (error) {
    console.error('❌ Error actualizando calendario:', error)
    return null
  }
}

async function main() {
  console.log('🔄 Actualizando todos los datos hasta hoy (13/11/2025)...\n')
  console.log(`📍 URL: ${APP_URL}`)
  console.log(`📅 Fecha: ${new Date().toLocaleDateString('es-ES')}\n`)

  if (!CRON_TOKEN) {
    console.warn('⚠️  CRON_TOKEN no configurado, algunos jobs pueden fallar')
  }
  if (!INGEST_KEY) {
    console.warn('⚠️  INGEST_KEY no configurado, noticias y calendario pueden fallar')
  }
  if (!FRED_API_KEY) {
    console.warn('⚠️  FRED_API_KEY no configurado, calendario puede fallar')
  }

  const results = {
    fred: null,
    correlations: null,
    bias: null,
    news: null,
    calendar: null,
  }

  // Actualizar datos FRED
  results.fred = await updateFredData()

  // Calcular correlaciones
  results.correlations = await updateCorrelations()

  // Calcular bias
  results.bias = await updateBias()

  // Actualizar noticias
  if (INGEST_KEY) {
    results.news = await updateNews()
  } else {
    console.log('\n⏭️  Saltando noticias (INGEST_KEY no configurado)')
  }

  // Actualizar calendario
  if (INGEST_KEY && FRED_API_KEY) {
    results.calendar = await updateCalendar()
  } else {
    console.log('\n⏭️  Saltando calendario (INGEST_KEY o FRED_API_KEY no configurado)')
  }

  // Resumen
  console.log('\n' + '='.repeat(50))
  console.log('📊 RESUMEN DE ACTUALIZACIÓN')
  console.log('='.repeat(50))
  console.log(`✅ Datos FRED: ${results.fred ? 'Actualizados' : 'Error'}`)
  console.log(`✅ Correlaciones: ${results.correlations ? 'Calculadas' : 'Error'}`)
  console.log(`✅ Bias: ${results.bias ? 'Calculado' : 'Error'}`)
  console.log(`✅ Noticias: ${results.news ? `${results.news.inserted || 0} insertadas` : 'Omitido/Error'}`)
  console.log(`✅ Calendario: ${results.calendar ? `${results.calendar.inserted || 0} eventos` : 'Omitido/Error'}`)
  console.log('='.repeat(50))
  console.log('\n✅ Actualización completada!')
}

main().catch(error => {
  console.error('\n❌ Error fatal:', error)
  process.exit(1)
})

