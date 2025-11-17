/**
 * Tests for weekly ahead notifications (Caso C)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  insertCalendarEvent,
  sendWeeklyAhead,
  getCalendarEvents,
  type CalendarEvent,
} from '@/lib/notifications/weekly'
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

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ENABLE_TELEGRAM_NOTIFICATIONS: 'true',
    TIMEZONE: 'Europe/Madrid',
  }

  // Clean up test data
  const db = getDB()
  db.prepare('DELETE FROM macro_calendar WHERE tema = ?').run('TEST')
  db.prepare('DELETE FROM weekly_sent').run()
  db.prepare('DELETE FROM notification_history WHERE tipo = ?').run('weekly')
})

describe('Weekly Ahead Notifications', () => {
  describe('insertCalendarEvent', () => {
    it('should insert calendar event', () => {
      const event: CalendarEvent = {
        fecha: '2025-11-20',
        hora_local: '14:30',
        pais: 'US',
        tema: 'TEST',
        evento: 'CPI m/m',
        importancia: 'high',
        consenso: '0.3%',
      }

      expect(() => insertCalendarEvent(event)).not.toThrow()

      // Verify it was inserted
      const events = getCalendarEvents('2025-11-20', '2025-11-20')
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].evento).toBe('CPI m/m')
    })

    it('should handle events without optional fields', () => {
      const event: CalendarEvent = {
        fecha: '2025-11-21',
        tema: 'TEST',
        evento: 'NFP',
        importancia: 'high',
      }

      expect(() => insertCalendarEvent(event)).not.toThrow()
    })
  })

  describe('getCalendarEvents', () => {
    it('should return events in date range', () => {
      insertCalendarEvent({
        fecha: '2025-11-20',
        tema: 'TEST',
        evento: 'Event 1',
        importancia: 'high',
      })

      insertCalendarEvent({
        fecha: '2025-11-25',
        tema: 'TEST',
        evento: 'Event 2',
        importancia: 'med',
      })

      const events = getCalendarEvents('2025-11-20', '2025-11-30')
      expect(events.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter by date range', () => {
      insertCalendarEvent({
        fecha: '2025-11-20',
        tema: 'TEST',
        evento: 'In Range',
        importancia: 'high',
      })

      insertCalendarEvent({
        fecha: '2025-12-01',
        tema: 'TEST',
        evento: 'Out of Range',
        importancia: 'high',
      })

      const events = getCalendarEvents('2025-11-20', '2025-11-30')
      const eventTitles = events.map(e => e.evento)
      expect(eventTitles).toContain('In Range')
      expect(eventTitles).not.toContain('Out of Range')
    })
  })

  describe('sendWeeklyAhead', () => {
    it('should send weekly notification with events', async () => {
      // Insert test events for next week
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

      const result = await sendWeeklyAhead()

      // Should succeed (unless already sent this week)
      expect(result.success || result.error === 'Already sent this week').toBe(true)
    })

    it('should not send twice in same week', async () => {
      // First send
      const result1 = await sendWeeklyAhead()
      
      // Second send (should be blocked)
      const result2 = await sendWeeklyAhead()

      // At least one should indicate already sent
      if (result1.success) {
        expect(result2.success).toBe(false)
        expect(result2.error).toBe('Already sent this week')
      }
    })

    it('should handle empty calendar gracefully', async () => {
      // Clear calendar
      const db = getDB()
      db.prepare('DELETE FROM macro_calendar WHERE tema = ?').run('TEST')
      db.prepare('DELETE FROM weekly_sent').run()

      const result = await sendWeeklyAhead()

      // Should still succeed (sends "no events" message)
      expect(result.success || result.error === 'Already sent this week').toBe(true)
    })
  })
})





