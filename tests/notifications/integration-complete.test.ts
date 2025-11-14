/**
 * Complete integration tests for notification system
 * Tests the full flow from news insertion to notification delivery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { insertNewsItem, type NewsItem } from '@/lib/notifications/news'
import { processNewsForNarrative } from '@/lib/notifications/narrative'
import { insertCalendarEvent, sendWeeklyAhead, type CalendarEvent } from '@/lib/notifications/weekly'
import { getDB } from '@/lib/db/schema'
import { getCurrentNarrative } from '@/lib/notifications/narrative'

// Mock Telegram to capture sent messages
const sentMessages: Array<{ text: string; options: any }> = []
vi.mock('@/lib/notifications/telegram', () => ({
  sendTelegramMessage: vi.fn(async (text: string, options: any = {}) => {
    sentMessages.push({ text, options })
    return {
      success: true,
      messageId: Math.floor(Math.random() * 100000),
    }
  }),
}))

// Mock metrics
vi.mock('@/lib/notifications/metrics', () => ({
  incrementMetric: vi.fn(),
}))

// Mock settings
vi.mock('@/lib/notifications/settings', () => ({
  getNotificationSettingNumber: vi.fn((key: string) => {
    if (key === 'NEWS_DEDUP_WINDOW_HOURS') return 2
    if (key === 'NARRATIVE_COOLDOWN_MINUTES') return 60
    if (key === 'DELTA_INFL_PP') return 0.2
    return null
  }),
}))

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ENABLE_TELEGRAM_NOTIFICATIONS: 'true',
    TIMEZONE: 'Europe/Madrid',
  }

  // Clean up
  const db = getDB()
  db.prepare('DELETE FROM news_items WHERE fuente = ?').run('TEST')
  db.prepare('DELETE FROM narrative_state').run()
  db.prepare('DELETE FROM macro_calendar WHERE tema = ?').run('TEST')
  db.prepare('DELETE FROM weekly_sent').run()
  db.prepare('DELETE FROM notification_history').run()
  
  sentMessages.length = 0
})

describe('Complete Integration Tests', () => {
  it('should handle full flow: news → notification → narrative', async () => {
    // 1. Insert news item
    const newsItem: NewsItem = {
      id_fuente: 'integration_001',
      fuente: 'TEST',
      pais: 'US',
      tema: 'Inflación',
      titulo: 'CPI m/m +0.5% vs esperado 0.2%',
      impacto: 'high',
      published_at: new Date().toISOString(),
      valor_publicado: 0.5,
      valor_esperado: 0.2,
      resumen: 'Inflación supera expectativas',
    }

    const insertResult = await insertNewsItem(newsItem)
    expect(insertResult.inserted).toBe(true)
    expect(insertResult.notified).toBe(true)

    // 2. Verify notification was sent
    expect(sentMessages.length).toBeGreaterThan(0)
    const newsMessage = sentMessages.find(m => m.text.includes('[NEW]'))
    expect(newsMessage).toBeDefined()
    expect(newsMessage?.text).toContain('US/Inflación')
    expect(newsMessage?.text).toContain('CPI m/m')

    // 3. Process for narrative
    await processNewsForNarrative({
      titulo: newsItem.titulo,
      tema: newsItem.tema,
      valor_publicado: newsItem.valor_publicado,
      valor_esperado: newsItem.valor_esperado,
      published_at: newsItem.published_at,
    })

    // 4. Verify narrative changed
    const narrative = getCurrentNarrative()
    expect(['INFLACION_ARRIBA', 'RISK_ON']).toContain(narrative)

    // 5. Verify narrative notification was sent
    const narrativeMessage = sentMessages.find(m => m.text.includes('[NARRATIVA]'))
    expect(narrativeMessage).toBeDefined()
  })

  it('should handle weekly ahead notification flow', async () => {
    // 1. Insert calendar events
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]

    insertCalendarEvent({
      fecha: nextWeekStr,
      hora_local: '14:30',
      pais: 'US',
      tema: 'TEST',
      evento: 'CPI m/m',
      importancia: 'high',
      consenso: '0.3%',
    })

    insertCalendarEvent({
      fecha: nextWeekStr,
      hora_local: '14:30',
      pais: 'US',
      tema: 'TEST',
      evento: 'NFP',
      importancia: 'med',
    })

    // 2. Send weekly ahead
    const result = await sendWeeklyAhead()

    // 3. Verify notification was sent (unless already sent this week)
    if (result.success) {
      const weeklyMessage = sentMessages.find(m => m.text.includes('[WEEK AHEAD]'))
      expect(weeklyMessage).toBeDefined()
      expect(weeklyMessage?.text).toContain('CPI m/m')
    } else {
      expect(result.error).toBe('Already sent this week')
    }
  })

  it('should respect deduplication for news', async () => {
    const newsItem: NewsItem = {
      id_fuente: 'dedup_test',
      fuente: 'TEST',
      titulo: 'Duplicate Test',
      impacto: 'high',
      published_at: new Date().toISOString(),
    }

    // First insert
    const result1 = await insertNewsItem(newsItem)
    expect(result1.notified).toBe(true)

    const messagesBefore = sentMessages.length

    // Second insert (duplicate)
    const result2 = await insertNewsItem(newsItem)
    expect(result2.notified).toBe(false)

    // Should not have sent another message
    expect(sentMessages.length).toBe(messagesBefore)
  })

  it('should handle multiple news items in sequence', async () => {
    const newsItems: NewsItem[] = [
      {
        id_fuente: 'multi_001',
        fuente: 'TEST',
        titulo: 'News 1',
        impacto: 'high',
        published_at: new Date().toISOString(),
      },
      {
        id_fuente: 'multi_002',
        fuente: 'TEST',
        titulo: 'News 2',
        impacto: 'med',
        published_at: new Date().toISOString(),
      },
      {
        id_fuente: 'multi_003',
        fuente: 'TEST',
        titulo: 'News 3',
        impacto: 'low',
        published_at: new Date().toISOString(),
      },
    ]

    for (const item of newsItems) {
      const result = await insertNewsItem(item)
      expect(result.inserted).toBe(true)
    }

    // Should have sent 3 notifications
    const newsNotifications = sentMessages.filter(m => m.text.includes('[NEW]'))
    expect(newsNotifications.length).toBe(3)
  })
})





