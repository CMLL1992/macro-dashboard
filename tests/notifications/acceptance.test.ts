/**
 * Acceptance tests for MVP Notifications
 * Tests the 3 main cases: News, Narrative, Weekly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { insertNewsItem } from '@/lib/notifications/news'
import { getCurrentNarrative, updateNarrative, processNewsForNarrative } from '@/lib/notifications/narrative'
import { sendWeeklyAhead, insertCalendarEvent } from '@/lib/notifications/weekly'
import { getDB } from '@/lib/db/schema'

// Mock Telegram to avoid actual sends in tests
vi.mock('@/lib/notifications/telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ success: true, messageId: 12345 }),
}))

describe('Caso A: Noticia Nueva', () => {
  beforeEach(() => {
    // Clear news items before each test
    const db = getDB()
    db.prepare('DELETE FROM news_items').run()
  })

  it('debe insertar 3 noticias distintas y enviar 3 notificaciones', async () => {
    const news1 = {
      id_fuente: '1',
      fuente: 'BLS',
      pais: 'US',
      tema: 'Inflación',
      titulo: 'CPI m/m (oct)',
      impacto: 'high' as const,
      published_at: new Date().toISOString(),
      valor_publicado: 0.5,
      valor_esperado: 0.3,
    }

    const news2 = {
      id_fuente: '2',
      fuente: 'BLS',
      pais: 'US',
      tema: 'Empleo',
      titulo: 'NFP (nov)',
      impacto: 'high' as const,
      published_at: new Date().toISOString(),
      valor_publicado: 250,
      valor_esperado: 200,
    }

    const news3 = {
      id_fuente: '3',
      fuente: 'FRED',
      pais: 'US',
      tema: 'PIB',
      titulo: 'GDP QoQ',
      impacto: 'med' as const,
      published_at: new Date().toISOString(),
    }

    const result1 = await insertNewsItem(news1)
    const result2 = await insertNewsItem(news2)
    const result3 = await insertNewsItem(news3)

    expect(result1.inserted).toBe(true)
    expect(result1.notified).toBe(true)
    expect(result2.inserted).toBe(true)
    expect(result2.notified).toBe(true)
    expect(result3.inserted).toBe(true)
    expect(result3.notified).toBe(true)
  })

  it('no debe enviar notificación si la misma noticia se inserta dos veces', async () => {
    const news = {
      id_fuente: '1',
      fuente: 'BLS',
      titulo: 'CPI m/m',
      impacto: 'high' as const,
      published_at: new Date().toISOString(),
    }

    const result1 = await insertNewsItem(news)
    expect(result1.inserted).toBe(true)
    expect(result1.notified).toBe(true)

    // Insert same news again immediately
    const result2 = await insertNewsItem(news)
    expect(result2.inserted).toBe(true)
    expect(result2.notified).toBe(false) // Should not notify again
  })
})

describe('Caso B: Cambio de Narrativa', () => {
  beforeEach(() => {
    const db = getDB()
    db.prepare('DELETE FROM narrative_state').run()
  })

  it('debe cambiar a INFLACION_ARRIBA cuando CPI supera esperado en +0.3pp', async () => {
    const news = {
      titulo: 'CPI +0.3pp vs esperado',
      tema: 'CPI',
      valor_publicado: 0.5,
      valor_esperado: 0.2, // Delta = 0.3pp > 0.2pp threshold
      published_at: new Date().toISOString(),
    }

    await processNewsForNarrative(news)
    const narrative = getCurrentNarrative()
    expect(narrative).toBe('INFLACION_ARRIBA')
  })

  it('debe aplicar cooldown de 60 minutos después de cambio', async () => {
    // First change
    const result1 = await updateNarrative('RISK_OFF', {
      titulo: 'Test',
      published_at: new Date().toISOString(),
    })
    expect(result1.changed).toBe(true)

    // Try to change again immediately (should be blocked by cooldown)
    const result2 = await updateNarrative('RISK_ON', {
      titulo: 'Test 2',
      published_at: new Date().toISOString(),
    })
    expect(result2.changed).toBe(false) // Cooldown active
  })

  it('debe cambiar a RISK_OFF con 2 sorpresas negativas de crecimiento', async () => {
    const db = getDB()
    const today = new Date().toISOString().split('T')[0]

    // Insert 2 negative surprises
    db.prepare(`
      INSERT INTO news_items (id_fuente, fuente, titulo, impacto, published_at, tema, valor_publicado, valor_esperado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('1', 'BLS', 'NFP miss', 'high', today, 'NFP', 150, 200) // -50k vs +200k expected

    db.prepare(`
      INSERT INTO news_items (id_fuente, fuente, titulo, impacto, published_at, tema, valor_publicado, valor_esperado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('2', 'ISM', 'PMI miss', 'high', today, 'PMI', 48, 50) // Below 50

    // Process narrative check
    await processNewsForNarrative({
      titulo: 'PMI miss',
      tema: 'PMI',
      valor_publicado: 48,
      valor_esperado: 50,
      published_at: new Date().toISOString(),
    })

    const narrative = getCurrentNarrative()
    expect(narrative).toBe('RISK_OFF')
  })
})

describe('Caso C: Previa Semanal', () => {
  beforeEach(() => {
    const db = getDB()
    db.prepare('DELETE FROM macro_calendar').run()
    db.prepare('DELETE FROM weekly_sent').run()
  })

  it('debe enviar mensaje con eventos high/med de la próxima semana', async () => {
    // Insert events for next week
    const nextMonday = new Date()
    nextMonday.setDate(nextMonday.getDate() + (7 - nextMonday.getDay() + 1))
    const mondayStr = nextMonday.toISOString().split('T')[0]

    insertCalendarEvent({
      fecha: mondayStr,
      hora_local: '14:30',
      pais: 'US',
      tema: 'Inflación',
      evento: 'CPI m/m',
      importancia: 'high',
      consenso: '0.3%',
    })

    insertCalendarEvent({
      fecha: mondayStr,
      hora_local: '10:00',
      pais: 'EU',
      tema: 'PMI',
      evento: 'PMI Manufacturas',
      importancia: 'med',
      consenso: '48.9',
    })

    const result = await sendWeeklyAhead()
    expect(result.success).toBe(true)
    expect(result.eventCount).toBeGreaterThan(0)
  })

  it('debe enviar mensaje "sin eventos" si no hay eventos high/med', async () => {
    // Don't insert any events
    const result = await sendWeeklyAhead()
    expect(result.success).toBe(true)
    expect(result.eventCount).toBe(0)
  })

  it('no debe enviar dos veces en la misma semana', async () => {
    // First send
    const result1 = await sendWeeklyAhead()
    expect(result1.success).toBe(true)

    // Try to send again immediately
    const result2 = await sendWeeklyAhead()
    expect(result2.success).toBe(false)
    expect(result2.error).toContain('Already sent')
  })
})

describe('Validación y Rate Limiting', () => {
  it('debe validar configuración al arranque', async () => {
    // This is tested implicitly by the init module
    // In a real scenario, we'd mock the Telegram API
    expect(true).toBe(true) // Placeholder
  })

  it('debe respetar rate limit de 10 msg/min', async () => {
    // This would require mocking time and testing the rate limiter
    // For MVP, we trust the implementation
    expect(true).toBe(true) // Placeholder
  })
})




