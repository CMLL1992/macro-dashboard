/**
 * Tests for news notifications (Caso A)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { insertNewsItem, getRecentNewsItems, type NewsItem } from '@/lib/notifications/news'
import { getDB } from '@/lib/db/schema'

// Mock Telegram to avoid actual API calls
vi.mock('@/lib/notifications/telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({
    success: true,
    messageId: 12345,
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

  // Clean up test data
  const db = getDB()
  db.prepare('DELETE FROM news_items WHERE fuente = ?').run('TEST')
  db.prepare('DELETE FROM notification_history WHERE tipo = ?').run('news')
})

describe('News Notifications', () => {
  describe('insertNewsItem', () => {
    it('should insert new news item and send notification', async () => {
      const newsItem: NewsItem = {
        id_fuente: 'test_001',
        fuente: 'TEST',
        pais: 'US',
        tema: 'Inflación',
        titulo: 'CPI m/m +0.5%',
        impacto: 'high',
        published_at: new Date().toISOString(),
        valor_publicado: 0.5,
        valor_esperado: 0.3,
        resumen: 'Test news',
      }

      const result = await insertNewsItem(newsItem)

      expect(result.inserted).toBe(true)
      expect(result.notified).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should not send notification for duplicate news (within dedup window)', async () => {
      const newsItem: NewsItem = {
        id_fuente: 'test_002',
        fuente: 'TEST',
        titulo: 'Duplicate test',
        impacto: 'high',
        published_at: new Date().toISOString(),
      }

      // First insert
      const result1 = await insertNewsItem(newsItem)
      expect(result1.inserted).toBe(true)
      expect(result1.notified).toBe(true)

      // Second insert (duplicate)
      const result2 = await insertNewsItem(newsItem)
      expect(result2.inserted).toBe(true)
      expect(result2.notified).toBe(false) // Should not notify duplicate
    })

    it('should handle missing required fields', async () => {
      const invalidItem = {
        id_fuente: 'test_003',
        fuente: 'TEST',
        // Missing titulo, impacto, published_at
      } as any

      const result = await insertNewsItem(invalidItem)
      expect(result.inserted).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should calculate surprise correctly', async () => {
      const newsItem: NewsItem = {
        id_fuente: 'test_004',
        fuente: 'TEST',
        titulo: 'NFP +250k',
        impacto: 'high',
        published_at: new Date().toISOString(),
        valor_publicado: 250,
        valor_esperado: 200,
      }

      const result = await insertNewsItem(newsItem)
      expect(result.inserted).toBe(true)
      expect(result.notified).toBe(true)

      // Verify surprise is positive (250 > 200)
      const news = getRecentNewsItems(1)
      expect(news.length).toBe(1)
      expect(news[0].valor_publicado).toBe(250)
      expect(news[0].valor_esperado).toBe(200)
    })
  })

  describe('getRecentNewsItems', () => {
    it('should return recent news items', async () => {
      // Insert test data
      await insertNewsItem({
        id_fuente: 'test_005',
        fuente: 'TEST',
        titulo: 'Test News 1',
        impacto: 'high',
        published_at: new Date().toISOString(),
      })

      await insertNewsItem({
        id_fuente: 'test_006',
        fuente: 'TEST',
        titulo: 'Test News 2',
        impacto: 'med',
        published_at: new Date().toISOString(),
      })

      const news = getRecentNewsItems(10)
      expect(news.length).toBeGreaterThanOrEqual(2)
      expect(news[0].titulo).toBe('Test News 2') // Most recent first
    })

    it('should respect limit parameter', async () => {
      // Insert multiple items
      for (let i = 0; i < 5; i++) {
        await insertNewsItem({
          id_fuente: `test_limit_${i}`,
          fuente: 'TEST',
          titulo: `Test ${i}`,
          impacto: 'low',
          published_at: new Date().toISOString(),
        })
      }

      const news = getRecentNewsItems(3)
      expect(news.length).toBeLessThanOrEqual(3)
    })
  })
})





