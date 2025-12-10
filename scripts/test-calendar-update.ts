/**
 * Script de prueba para el job de actualización del calendario
 * Ejecuta directamente la lógica del job sin necesidad de HTTP
 * 
 * Uso:
 *   pnpm tsx scripts/test-calendar-update.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const TE_BASE = 'https://api.tradingeconomics.com'

type EventCountry = 'US' | 'EA' | 'GB' | 'JP' | 'AU'

interface MacroEvent {
  id: string
  date: string
  time: string | null
  country: EventCountry
  indicatorKey: string
  title: string
  previous: number | null
  consensus: number | null
  impact: 'high' | 'medium'
  source: 'trading_economics' | 'estimated'
}

function loadCalendarConfig(): Record<string, {
  country: EventCountry
  provider: string
  te_category?: string
  te_symbol?: string
  impact: 'high' | 'medium'
  frequency?: 'monthly' | 'quarterly'
  typical_day?: number
}> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'calendar-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    const json = JSON.parse(raw)
    return json.indicators || {}
  } catch (error) {
    console.error('Failed to load calendar config:', error)
    return {}
  }
}

async function fetchTradingEconomicsCalendar(
  fromDate: string,
  toDate: string,
  countries: string[] = ['united states', 'euro area']
): Promise<any[]> {
  const apiKey = process.env.TRADING_ECONOMICS_API_KEY || 'guest:guest'
  const auth = apiKey.includes(':') ? apiKey : `${apiKey}:${apiKey}`
  
  try {
    const url = `${TE_BASE}/calendar?c=${auth}&d1=${fromDate}&d2=${toDate}`
    console.log(`📅 Fetching calendar from Trading Economics...`)
    console.log(`   URL: ${url.replace(auth, '***')}`)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Trading Economics API returned ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.warn('⚠️  Trading Economics returned non-array data')
      return []
    }
    
    const filtered = data.filter((event: any) => {
      const country = (event.Country || '').toLowerCase()
      return countries.some(c => country.includes(c.toLowerCase()))
    })
    
    console.log(`✅ Fetched ${data.length} total events, ${filtered.length} for US/EU`)
    
    // Mostrar algunos ejemplos de eventos para depuración
    if (data.length > 0 && filtered.length === 0) {
      console.log(`\n🔍 Primeros eventos recibidos (para depuración):`)
      data.slice(0, 3).forEach((event: any, idx: number) => {
        console.log(`   ${idx + 1}. ${event.Country || 'N/A'} - ${event.Event || 'N/A'} (${event.Date || 'N/A'})`)
      })
    }
    
    return filtered
  } catch (error) {
    console.error('❌ Failed to fetch Trading Economics calendar:', error)
    return []
  }
}

function matchEventToIndicator(
  teEvent: any,
  config: ReturnType<typeof loadCalendarConfig>
): { indicatorKey: string; meta: any } | null {
  const eventTitle = (teEvent.Event || '').toLowerCase()
  const eventCategory = (teEvent.Category || '').toLowerCase()
  const eventCountry = (teEvent.Country || '').toLowerCase()
  
  const countryMap: Record<string, EventCountry> = {
    'united states': 'US',
    'usa': 'US',
    'us': 'US',
    'euro area': 'EA',
    'eurozone': 'EA',
    'euro area (19)': 'EA',
    'euro area (20)': 'EA',
  }
  
  let eventCountryCode: EventCountry | null = null
  for (const [teCountry, code] of Object.entries(countryMap)) {
    if (eventCountry.includes(teCountry.toLowerCase())) {
      eventCountryCode = code
      break
    }
  }
  
  if (!eventCountryCode) return null
  
  for (const [indicatorKey, meta] of Object.entries(config)) {
    if (meta.country !== eventCountryCode) continue
    
    if (meta.te_category) {
      const categoryLower = meta.te_category.toLowerCase()
      if (eventCategory.includes(categoryLower) || eventTitle.includes(categoryLower)) {
        return { indicatorKey, meta }
      }
    }
    
    if (meta.te_symbol) {
      const symbolLower = meta.te_symbol.toLowerCase()
      if (eventTitle.includes(symbolLower)) {
        return { indicatorKey, meta }
      }
    }
    
    const patterns: Record<string, string[]> = {
      'CPIAUCSL': ['consumer price index', 'cpi', 'inflation rate'],
      'CPILFESL': ['core cpi', 'core consumer price', 'core inflation'],
      'PCEPILFE': ['core pce', 'core personal consumption', 'core pce price'],
      'PAYEMS': ['non farm payrolls', 'nfp', 'payrolls', 'employment'],
      'GDPC1': ['gdp', 'gross domestic product', 'gdp growth'],
      'UNRATE': ['unemployment rate', 'unemployment'],
      'FEDFUNDS': ['fed funds', 'federal funds', 'interest rate decision', 'fomc'],
      'USPMI': ['ism manufacturing', 'manufacturing pmi', 'ism pmi'],
      'USPMI_SERVICES': ['ism services', 'services pmi'],
      'EU_CPI_YOY': ['inflation rate', 'hicp', 'consumer price'],
      'EU_CPI_CORE_YOY': ['core inflation', 'core hicp'],
      'EU_GDP_QOQ': ['gdp', 'gross domestic product'],
      'EU_GDP_YOY': ['gdp', 'gross domestic product'],
      'EU_UNEMPLOYMENT': ['unemployment rate'],
      'EU_ECB_RATE': ['ecb', 'interest rate decision', 'ecb rate'],
      'EU_PMI_COMPOSITE': ['composite pmi'],
      'EU_PMI_MANUFACTURING': ['manufacturing pmi'],
      'EU_PMI_SERVICES': ['services pmi'],
    }
    
    const indicatorPatterns = patterns[indicatorKey] || []
    for (const pattern of indicatorPatterns) {
      if (eventTitle.includes(pattern) || eventCategory.includes(pattern)) {
        return { indicatorKey, meta }
      }
    }
  }
  
  return null
}

async function main() {
  console.log('🚀 Iniciando actualización del calendario macroeconómico...\n')
  
  const config = loadCalendarConfig()
  console.log(`📋 Configuración cargada: ${Object.keys(config).length} indicadores\n`)
  
  const today = new Date()
  const fromDate = today.toISOString().split('T')[0]
  const toDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  console.log(`📅 Rango de fechas: ${fromDate} → ${toDate}\n`)
  
  // Obtener eventos de Trading Economics
  const teEvents = await fetchTradingEconomicsCalendar(fromDate, toDate, ['united states', 'euro area'])
  
  if (teEvents.length === 0) {
    console.log('⚠️  No se obtuvieron eventos de Trading Economics')
    console.log('   Esto puede ser normal si no hay eventos programados o si la API no responde')
    return
  }
  
  console.log(`\n🔍 Mapeando eventos a indicadores internos...\n`)
  
  const mappedEvents: MacroEvent[] = []
  const matchedCounts: Record<string, number> = {}
  
  for (const teEvent of teEvents) {
    const match = matchEventToIndicator(teEvent, config)
    if (!match) continue
    
    const { indicatorKey, meta } = match
    const eventDate = teEvent.Date ? teEvent.Date.split('T')[0] : null
    if (!eventDate) continue
    
    matchedCounts[indicatorKey] = (matchedCounts[indicatorKey] || 0) + 1
    
    const previous = teEvent.Previous ? parseFloat(String(teEvent.Previous)) : null
    const consensus = teEvent.Forecast ? parseFloat(String(teEvent.Forecast)) : null
    
    let time: string | null = null
    const timeStr = teEvent.Date
    if (timeStr && timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1]
      if (timePart) {
        const [hours, minutes] = timePart.split(':')
        if (hours && minutes) {
          time = `${hours}:${minutes}`
        }
      }
    }
    
    // Obtener título desde sources
    let title = teEvent.Event || indicatorKey
    try {
      const sourcesPath = path.join(process.cwd(), 'lib', 'sources.ts')
      // Intentar leer el archivo y extraer el título (simplificado)
      // Por ahora usamos el título del evento de TE
    } catch {}
    
    mappedEvents.push({
      id: `${indicatorKey}_${eventDate}`,
      date: eventDate,
      time,
      country: meta.country,
      indicatorKey,
      title,
      previous: isNaN(previous!) ? null : previous,
      consensus: isNaN(consensus!) ? null : consensus,
      impact: meta.impact,
      source: 'trading_economics',
    })
  }
  
  console.log(`✅ Eventos mapeados: ${mappedEvents.length}`)
  console.log(`\n📊 Resumen por indicador:`)
  for (const [key, count] of Object.entries(matchedCounts)) {
    console.log(`   ${key}: ${count} evento(s)`)
  }
  
  if (mappedEvents.length === 0) {
    console.log('\n⚠️  No se mapearon eventos. Esto puede ser normal si:')
    console.log('   - No hay eventos programados en los próximos 7 días')
    console.log('   - Los nombres de eventos no coinciden con los patrones')
    console.log('   - La API de Trading Economics no devuelve los eventos esperados')
    return
  }
  
  // Guardar en base de datos
  console.log(`\n💾 Guardando eventos en base de datos...\n`)
  
  // Detectar si es Turso o SQLite local
  const isTurso = process.env.TURSO_DB_URL && process.env.TURSO_AUTH_TOKEN
  let inserted = 0
  let updated = 0
  
  if (isTurso) {
    console.log('⚠️  Turso detectado. Para guardar en Turso, usa el endpoint HTTP del job.')
    console.log('   Por ahora, solo mostramos los eventos que se guardarían.\n')
  } else {
    // SQLite local
    const dbPath = path.join(process.cwd(), 'data', 'macro.db')
    if (!fs.existsSync(dbPath)) {
      console.error(`❌ Base de datos no encontrada en: ${dbPath}`)
      console.log('   Asegúrate de que la base de datos existe antes de ejecutar este script.')
      return
    }
    
    const db = new Database(dbPath)
    
    // Asegurar que la tabla existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS macro_events (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT,
        country TEXT NOT NULL,
        indicator_key TEXT NOT NULL,
        title TEXT NOT NULL,
        previous REAL,
        consensus REAL,
        impact TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO macro_events 
      (id, date, time, country, indicator_key, title, previous, consensus, impact, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    for (const event of mappedEvents) {
      try {
        const result = stmt.run(
          event.id,
          event.date,
          event.time,
          event.country,
          event.indicatorKey,
          event.title,
          event.previous,
          event.consensus,
          event.impact,
          event.source
        )
        if (result.changes > 0) {
          inserted++
        } else {
          updated++
        }
      } catch (error) {
        console.error(`❌ Error insertando evento ${event.id}:`, error)
      }
    }
    
    db.close()
    
    console.log(`✅ Guardado completado:`)
    console.log(`   - Insertados: ${inserted}`)
    console.log(`   - Actualizados: ${updated}`)
    console.log(`   - Total: ${mappedEvents.length}`)
    
    // Verificar que se guardaron correctamente
    console.log(`\n🔍 Verificando eventos guardados...\n`)
    
    try {
      const dbCheck = new Database(dbPath)
      const row = dbCheck.prepare(`
        SELECT COUNT(*) as count FROM macro_events WHERE date >= ? AND date <= ?
      `).get(fromDate, toDate) as { count: number }
      console.log(`✅ Eventos en BD para el rango: ${row.count}`)
      dbCheck.close()
    } catch (error) {
      console.error('❌ Error verificando eventos:', error)
    }
  }
  
  console.log(`\n✨ Proceso completado!\n`)
  console.log(`📌 Próximos pasos:`)
  console.log(`   1. Revisa la página de Noticias para ver los eventos`)
  console.log(`   2. Programa este job para ejecutarse diariamente`)
  console.log(`   3. Los eventos se actualizarán automáticamente\n`)
}

// Ejecutar si es el módulo principal
main().catch(console.error)

export { main }

