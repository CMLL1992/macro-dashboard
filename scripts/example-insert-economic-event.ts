/**
 * Ejemplo: Insertar evento económico y release
 * 
 * Uso:
 *   pnpm tsx scripts/example-insert-economic-event.ts
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { upsertEconomicRelease, recordMacroEventImpact } from '@/lib/db/economic-events'
import { getMacroDiagnosis } from '@/domain/diagnostic'

async function example() {
  console.log('📅 Ejemplo: Insertar evento económico y release\n')

  const db = isUsingTurso() ? getUnifiedDB() : getDB()

  // 1. Crear evento en el calendario
  console.log('1. Creando evento en el calendario...')
  
  let eventId: number
  
  if (isUsingTurso()) {
    const result = await db.prepare(`
      INSERT INTO economic_events (
        country, currency, name, category, importance,
        series_id, indicator_key,
        scheduled_time_utc,
        consensus_value, previous_value,
        directionality,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      'US',
      'USD',
      'CPI YoY',
      'Inflation',
      'high',
      'CPIAUCSL',
      'us_cpi_yoy',
      new Date().toISOString(),
      3.1,
      3.2,
      'higher_is_positive',
      new Date().toISOString(),
      new Date().toISOString()
    ) as { id: number }
    eventId = result.id
  } else {
    db.prepare(`
      INSERT INTO economic_events (
        country, currency, name, category, importance,
        series_id, indicator_key,
        scheduled_time_utc,
        consensus_value, previous_value,
        directionality,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'US',
      'USD',
      'CPI YoY',
      'Inflation',
      'high',
      'CPIAUCSL',
      'us_cpi_yoy',
      new Date().toISOString(),
      3.1,
      3.2,
      'higher_is_positive',
      new Date().toISOString(),
      new Date().toISOString()
    )
    const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }
    eventId = lastId.id
  }

  console.log(`✅ Evento creado con ID: ${eventId}\n`)

  // 2. Crear release cuando sale el dato real
  console.log('2. Creando release (dato publicado)...')
  
  const release = await upsertEconomicRelease({
    event_id: eventId,
    release_time_utc: new Date().toISOString(),
    release_time_local: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
    actual_value: 3.4,  // Valor publicado (sorprende al alza)
    previous_value: 3.2,
    consensus_value: 3.1,
    directionality: 'higher_is_positive',
    notes: 'CPI sorprendió fuertemente al alza',
  })

  console.log(`✅ Release creado con ID: ${release.id}`)
  console.log(`   Sorpresa raw: ${release.surprise_raw}`)
  console.log(`   Sorpresa %: ${((release.surprise_pct || 0) * 100).toFixed(2)}%`)
  console.log(`   Sorpresa score: ${release.surprise_score?.toFixed(2)}`)
  console.log(`   Dirección: ${release.surprise_direction}\n`)

  // 3. Calcular impacto (opcional)
  console.log('3. Calculando impacto en sesgos macro...')
  
  try {
    const diagnosisBefore = await getMacroDiagnosis()
    const usdScoreBefore = diagnosisBefore.currencyScores?.USD?.totalScore ?? null
    const usdRegimeBefore = diagnosisBefore.currencyRegimes?.USD?.regime ?? null

    console.log(`   Score USD antes: ${usdScoreBefore}`)
    console.log(`   Régimen USD antes: ${usdRegimeBefore}`)

    // En un caso real, aquí actualizarías los datos macro y recalcularías
    // Por ahora, simulamos un cambio
    const usdScoreAfter = (usdScoreBefore ?? 0) + 0.12
    const usdRegimeAfter = usdScoreAfter > 0.2 ? 'reflation' : 'mixed'

    await recordMacroEventImpact({
      release_id: release.id,
      currency: 'USD',
      total_score_before: usdScoreBefore,
      total_score_after: usdScoreAfter,
      regime_before: usdRegimeBefore || null,
      regime_after: usdRegimeAfter,
      usd_direction_before: (diagnosisBefore as any).currencyRegimes?.USD?.usd_direction ?? null,
      usd_direction_after: usdScoreAfter > 0.25 ? 'Bullish' : 'Neutral',
    })

    console.log(`✅ Impacto registrado`)
    console.log(`   Score USD después: ${usdScoreAfter}`)
    console.log(`   Régimen USD después: ${usdRegimeAfter}\n`)
  } catch (error) {
    console.warn('⚠️  No se pudo calcular impacto (puede ser normal si no hay datos suficientes):', error)
  }

  console.log('✅ Ejemplo completado!')
  console.log('\n📡 Prueba el endpoint: GET /api/bias')
  console.log('   Deberías ver el evento en "recentEvents"')
}

example().catch(console.error)

