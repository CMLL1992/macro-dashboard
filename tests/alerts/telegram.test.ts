/**
 * Unit tests for Telegram alerts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildUSDChangeMessage, buildCorrelationChangeMessage, buildMacroReleaseMessage } from '@/lib/alerts/builders'
import { calculateCorrelationLevel } from '@/lib/alerts/state'

describe('Alert Builders', () => {
  describe('buildUSDChangeMessage', () => {
    it('should build USD change message correctly', () => {
      const message = buildUSDChangeMessage(
        'Neutral',
        'Débil',
        'Neutral',
        -0.30,
        '2025-11-07',
        'Test: 1 · Test: 2'
      )

      expect(message).toContain('Cambio USD')
      expect(message).toContain('Neutral')
      expect(message).toContain('Débil')
      expect(message).toContain('-0.30')
      expect(message).toContain('2025-11-07')
      expect(message).toContain('#macro #usd')
    })

    it('should handle null previous state', () => {
      const message = buildUSDChangeMessage(
        null,
        'Fuerte',
        'RISK ON',
        0.50,
        null,
        ''
      )

      expect(message).toContain('N/A')
      expect(message).toContain('Fuerte')
    })
  })

  describe('buildCorrelationChangeMessage', () => {
    it('should build correlation change message correctly', () => {
      const message = buildCorrelationChangeMessage(
        'EURUSD',
        '12m',
        'Alta',
        0.65,
        'Directa',
        0.65,
        0.70
      )

      expect(message).toContain('Correlación 12m cambió')
      expect(message).toContain('EURUSD')
      expect(message).toContain('Alta')
      expect(message).toContain('0.65')
      expect(message).toContain('Directa')
      expect(message).toContain('#correlaciones #usd')
    })

    it('should handle inverse relationship', () => {
      const message = buildCorrelationChangeMessage(
        'EURUSD',
        '3m',
        'Media',
        -0.45,
        'Inversa',
        -0.59,
        -0.45
      )

      expect(message).toContain('Inversa')
      expect(message).toContain('USD ↑ ⇒ EURUSD ↓')
    })
  })

  describe('buildMacroReleaseMessage', () => {
    it('should build macro release message correctly', () => {
      const message = buildMacroReleaseMessage(
        'CPI YoY',
        3.02,
        3.08,
        '2025-11-01',
        'Mejora',
        'Dovish',
        'Inflación cede ⇒ USD tiende a debilitarse.',
        'CPIAUCSL'
      )

      expect(message).toContain('Nuevo dato macro')
      expect(message).toContain('CPI YoY')
      expect(message).toContain('3.02')
      expect(message).toContain('3.08')
      expect(message).toContain('Mejora')
      expect(message).toContain('Dovish')
      expect(message).toContain('#macro #datos')
    })
  })
})

describe('Alert State', () => {
  describe('calculateCorrelationLevel', () => {
    it('should return Alta for |r| >= 0.60', () => {
      expect(calculateCorrelationLevel(0.65)).toBe('Alta')
      expect(calculateCorrelationLevel(-0.70)).toBe('Alta')
    })

    it('should return Media for 0.30 <= |r| < 0.60', () => {
      expect(calculateCorrelationLevel(0.45)).toBe('Media')
      expect(calculateCorrelationLevel(-0.35)).toBe('Media')
    })

    it('should return Baja for |r| < 0.30', () => {
      expect(calculateCorrelationLevel(0.25)).toBe('Baja')
      expect(calculateCorrelationLevel(-0.15)).toBe('Baja')
    })

    it('should return null for invalid values', () => {
      expect(calculateCorrelationLevel(null)).toBeNull()
      expect(calculateCorrelationLevel(undefined)).toBeNull()
      expect(calculateCorrelationLevel(NaN)).toBeNull()
    })
  })
})





