/**
 * Test rápido para verificar providers de calendario con URLs reales.
 * 
 * Ejecutar: pnpm tsx scripts/test-calendar-providers.ts
 */

import 'dotenv/config'
import { ICSProvider } from '../lib/calendar/providers/icsProvider'
import { JSONProvider } from '../lib/calendar/providers/jsonProvider'
import { HTMLProvider } from '../lib/calendar/providers/htmlProvider'
import { isHighImpactEvent } from '../config/calendar-whitelist'
import { ProviderCalendarEvent } from '../lib/calendar/types'

type CalendarEvent = {
  source: string // "Eurostat" | "BLS" | "BEA" | ...
  provider: string // "ics" | "json" | "html"
  country?: string // "United States", "Euro Area", etc.
  title: string
  date: Date // debe estar en UTC
  importance: number // debe ser 3 tras whitelist
  externalId?: string // opcional: UID/ID del feed
  previous?: number | null
  consensus?: number | null
  actual?: number | null
}

// Helpers
const now = new Date()
const start = new Date(now)
start.setUTCDate(start.getUTCDate() - 14)
const end = new Date(now)
end.setUTCDate(end.getUTCDate() + 45)

function toISO(d: Date) {
  return d.toISOString().replace('.000Z', 'Z')
}

function inRange(d: Date, a: Date, b: Date) {
  return d.getTime() >= a.getTime() && d.getTime() <= b.getTime()
}

function keyForDedup(e: CalendarEvent) {
  // Usar externalId si está disponible, sino fallback
  return `${e.source}|${e.externalId ?? ''}|${e.title}|${toISO(e.date)}`
}

function printSample(events: CalendarEvent[], n = 8) {
  const sample = events
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, n)

  for (const e of sample) {
    console.log(
      `  - ${toISO(e.date)} | ${e.source} | ${e.country ?? '-'} | imp=${e.importance} | ${e.title}`
    )
  }
}

/**
 * Convierte ProviderCalendarEvent a CalendarEvent para testing
 */
function toCalendarEvent(
  ev: ProviderCalendarEvent,
  source: string,
  provider: string
): CalendarEvent {
  return {
    source,
    provider,
    country: ev.country,
    title: ev.name,
    date: new Date(ev.scheduledTimeUTC),
    importance: ev.importance === 'high' ? 3 : ev.importance === 'medium' ? 2 : 1,
    externalId: ev.externalId,
    previous: ev.previous ?? null,
    consensus: ev.consensus ?? null,
    actual: ev.actual ?? null,
  }
}

async function testProvider(
  name: string,
  fetcher: () => Promise<ProviderCalendarEvent[]>
) {
  console.log(`\n====================`)
  console.log(`TEST PROVIDER: ${name}`)
  console.log(`Rango: ${toISO(start)} -> ${toISO(end)}`)
  console.log(`====================`)

  const t0 = Date.now()
  let events: ProviderCalendarEvent[] = []
  
  try {
    events = await fetcher()
  } catch (error) {
    console.error(`❌ ERROR al obtener eventos:`, error)
    return { name, pass: false, count: 0, okCount: 0, error: String(error) }
  }
  
  const ms = Date.now() - t0

  // Convertir a CalendarEvent para validación
  const calendarEvents = events.map(ev => {
    // Determinar source desde externalId o provider
    const source = ev.externalId?.split('-')[0] || 'Unknown'
    const provider = name.toLowerCase().includes('ics') ? 'ics' : 
                    name.toLowerCase().includes('json') ? 'json' : 'html'
    return toCalendarEvent(ev, source, provider)
  })

  console.log(`Total eventos devueltos: ${calendarEvents.length} (${ms} ms)`)

  // Validaciones
  const outOfRange = calendarEvents.filter(e => !inRange(e.date, start, end))
  const nonHigh = calendarEvents.filter(e => e.importance !== 3)
  const nonWhitelist = calendarEvents.filter(e => {
    const match = isHighImpactEvent(e.title, e.country || '')
    return match === null
  })

  // Duplicados (en memoria)
  const seen = new Set<string>()
  const dups: string[] = []
  for (const e of calendarEvents) {
    const k = keyForDedup(e)
    if (seen.has(k)) dups.push(k)
    seen.add(k)
  }

  // Valores: no queremos strings raros
  const badNumbers = calendarEvents.filter(e => {
    const nums = [e.actual, e.previous, e.consensus]
    return nums.some(v => v !== null && v !== undefined && typeof v === 'string')
  })

  console.log(`Fuera de rango: ${outOfRange.length}`)
  console.log(`Importance != 3: ${nonHigh.length}`)
  console.log(`No pasa whitelist: ${nonWhitelist.length}`)
  console.log(`Duplicados (heurística): ${dups.length}`)
  console.log(`Valores numéricos inválidos: ${badNumbers.length}`)

  // Muestra ejemplos si hay fallos
  if (outOfRange.length > 0) {
    console.log('\nEjemplos fuera de rango:')
    printSample(outOfRange, 5)
  }
  if (nonHigh.length > 0) {
    console.log('\nEjemplos con importance != 3:')
    printSample(nonHigh, 5)
  }
  if (nonWhitelist.length > 0) {
    console.log('\nEjemplos que NO pasan whitelist (revisar regex/mapeo):')
    printSample(nonWhitelist, 8)
  }
  if (badNumbers.length > 0) {
    console.log('\nEjemplos con números mal tipados:')
    for (const e of badNumbers.slice(0, 5)) {
      console.log(
        `  - ${e.title} | actual=${String(e.actual)} prev=${String(e.previous)} fc=${String(e.consensus)}`
      )
    }
  }

  // Muestra muestra de eventos correctos
  const ok = calendarEvents.filter(
    e =>
      inRange(e.date, start, end) &&
      e.importance === 3 &&
      isHighImpactEvent(e.title, e.country || '') !== null
  )
  console.log(`\nEventos OK (rango + imp=3 + whitelist): ${ok.length}`)
  if (ok.length > 0) {
    console.log('Muestra:')
    printSample(ok, 10)
  } else {
    console.log('⚠️  No hay eventos OK. Revisar:')
    console.log('  - ¿Las URLs están correctas?')
    console.log('  - ¿Los selectores HTML son correctos?')
    console.log('  - ¿El whitelist está filtrando todo?')
  }

  // Resultado final del provider
  const pass =
    outOfRange.length === 0 &&
    nonHigh.length === 0 &&
    nonWhitelist.length === 0 &&
    badNumbers.length === 0 &&
    ok.length > 0 // Debe haber al menos algunos eventos OK

  console.log(`\nRESULTADO: ${pass ? '✅ PASS' : '❌ FAIL (ver arriba)'}`)
  return { name, pass, count: calendarEvents.length, okCount: ok.length }
}

async function main() {
  console.log('🧪 Test de Providers de Calendario')
  console.log(`Fecha actual: ${toISO(now)}`)
  console.log(`Rango de test: ${toISO(start)} -> ${toISO(end)} (${Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))} días)`)

  // Instanciar providers
  const ics = new ICSProvider()
  const json = new JSONProvider()
  const html = new HTMLProvider()

  const results = []

  // Test ICS Provider
  results.push(
    await testProvider('ICS Provider (Eurostat/BLS/BEA/INE/BdE)', () =>
      ics.fetchCalendar({
        from: start,
        to: end,
        minImportance: 'high',
      })
    )
  )

  // Test JSON Provider
  results.push(
    await testProvider('JSON Provider (BEA JSON)', () =>
      json.fetchCalendar({
        from: start,
        to: end,
        minImportance: 'high',
      })
    )
  )

  // Test HTML Provider
  results.push(
    await testProvider('HTML Provider (ONS/Fed/Destatis)', () =>
      html.fetchCalendar({
        from: start,
        to: end,
        minImportance: 'high',
      })
    )
  )

  console.log(`\n====================`)
  console.log(`RESUMEN`)
  console.log(`====================`)
  for (const r of results) {
    const status = r.pass ? '✅' : '❌'
    console.log(
      `- ${r.name}: ${status} | total=${r.count} | ok=${r.okCount}${r.error ? ` | error=${r.error}` : ''}`
    )
  }

  const allPass = results.every(r => r.pass)
  const totalOk = results.reduce((sum, r) => sum + r.okCount, 0)
  
  console.log(`\nTotal eventos OK: ${totalOk}`)
  console.log(`Estado general: ${allPass ? '✅ TODOS LOS TESTS PASARON' : '❌ ALGUNOS TESTS FALLARON'}`)
  
  process.exit(allPass ? 0 : 1)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
