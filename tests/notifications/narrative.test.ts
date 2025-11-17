/**
 * Tests for narrative state management (Caso B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCurrentNarrative,
  calculateNarrativeCandidate,
  checkMultipleNegativeSurprises,
  updateNarrative,
  processNewsForNarrative,
  type NarrativeState,
} from '@/lib/notifications/narrative'
import { insertNewsItem } from '@/lib/notifications/news'
import { getDB } from '@/lib/db/schema'

// Mock Telegram
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

  // Clean up test data
  const db = getDB()
  db.prepare('DELETE FROM narrative_state').run()
  db.prepare('DELETE FROM news_items WHERE fuente = ?').run('TEST')
  db.prepare('DELETE FROM notification_history WHERE tipo = ?').run('narrative')
})

describe('Narrative State Management', () => {
  describe('getCurrentNarrative', () => {
    it('should return NEUTRAL when no state exists', () => {
      const narrative = getCurrentNarrative()
      expect(narrative).toBe('NEUTRAL')
    })

    it('should return stored narrative state', async () => {
      await updateNarrative('RISK_ON')
      const narrative = getCurrentNarrative()
      expect(narrative).toBe('RISK_ON')
    })
  })

  describe('calculateNarrativeCandidate', () => {
    it('should detect INFLACION_ARRIBA from high CPI surprise', () => {
      const candidate = calculateNarrativeCandidate({
        titulo: 'CPI +0.5%',
        tema: 'Inflación',
        valor_publicado: 0.5,
        valor_esperado: 0.2,
        published_at: new Date().toISOString(),
      })

      expect(candidate).toBe('INFLACION_ARRIBA')
    })

    it('should detect INFLACION_ABAJO from low CPI surprise', () => {
      const candidate = calculateNarrativeCandidate({
        titulo: 'CPI -0.2%',
        tema: 'CPI',
        valor_publicado: 0.1,
        valor_esperado: 0.3,
        published_at: new Date().toISOString(),
      })

      expect(candidate).toBe('INFLACION_ABAJO')
    })

    it('should detect RISK_ON from positive keywords', () => {
      const candidate = calculateNarrativeCandidate({
        titulo: 'NFP above expectations, strong growth',
        published_at: new Date().toISOString(),
      })

      expect(candidate).toBe('RISK_ON')
    })

    it('should detect RISK_OFF from negative keywords', () => {
      const candidate = calculateNarrativeCandidate({
        titulo: 'NFP miss, weak employment data',
        published_at: new Date().toISOString(),
      })

      expect(candidate).toBe('RISK_OFF')
    })

    it('should return null for neutral news', () => {
      const candidate = calculateNarrativeCandidate({
        titulo: 'Regular economic update',
        published_at: new Date().toISOString(),
      })

      expect(candidate).toBeNull()
    })
  })

  describe('checkMultipleNegativeSurprises', () => {
    it('should detect RISK_OFF from multiple negative surprises', async () => {
      const today = new Date().toISOString().split('T')[0]

      // Insert 2 negative surprises
      await insertNewsItem({
        id_fuente: 'test_nfp_1',
        fuente: 'TEST',
        tema: 'NFP',
        titulo: 'NFP miss',
        impacto: 'high',
        published_at: `${today}T14:00:00Z`,
        valor_publicado: 150,
        valor_esperado: 200,
      })

      await insertNewsItem({
        id_fuente: 'test_pmi_1',
        fuente: 'TEST',
        tema: 'PMI',
        titulo: 'PMI weak',
        impacto: 'high',
        published_at: `${today}T15:00:00Z`,
        valor_publicado: 45,
        valor_esperado: 50,
      })

      const candidate = checkMultipleNegativeSurprises()
      expect(candidate).toBe('RISK_OFF')
    })

    it('should return null with only one negative surprise', async () => {
      const today = new Date().toISOString().split('T')[0]

      await insertNewsItem({
        id_fuente: 'test_single',
        fuente: 'TEST',
        tema: 'NFP',
        titulo: 'NFP miss',
        impacto: 'high',
        published_at: `${today}T14:00:00Z`,
        valor_publicado: 150,
        valor_esperado: 200,
      })

      const candidate = checkMultipleNegativeSurprises()
      expect(candidate).toBeNull()
    })
  })

  describe('updateNarrative', () => {
    it('should update narrative state and send notification', async () => {
      const result = await updateNarrative('RISK_ON')

      expect(result.changed).toBe(true)
      expect(result.notified).toBe(true)
      expect(getCurrentNarrative()).toBe('RISK_ON')
    })

    it('should not change if same state', async () => {
      await updateNarrative('RISK_ON')
      const result = await updateNarrative('RISK_ON')

      expect(result.changed).toBe(false)
      expect(result.notified).toBe(false)
    })

    it('should respect cooldown period', async () => {
      await updateNarrative('RISK_ON')
      
      // Try to change immediately (should be blocked by cooldown)
      const result = await updateNarrative('RISK_OFF')

      expect(result.changed).toBe(false)
      expect(result.notified).toBe(false)
    })
  })

  describe('processNewsForNarrative', () => {
    it('should process news and update narrative', async () => {
      await processNewsForNarrative({
        titulo: 'CPI +0.5% above expectations',
        tema: 'Inflación',
        valor_publicado: 0.5,
        valor_esperado: 0.2,
        published_at: new Date().toISOString(),
      })

      // Should have triggered narrative change
      const narrative = getCurrentNarrative()
      expect(['INFLACION_ARRIBA', 'RISK_ON']).toContain(narrative)
    })
  })
})





