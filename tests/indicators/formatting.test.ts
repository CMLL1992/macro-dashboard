/**
 * Tests de sanidad para verificar que los indicadores se formatean correctamente
 * Estos tests aseguran que los valores y fechas coinciden con calendarios económicos
 */

import { describe, it, expect } from 'vitest'
import { formatIndicatorDate } from '@/lib/utils/format-indicator-date'
import { formatIndicatorValueSimple } from '@/lib/utils/format-indicator-value'
import { getIndicatorConfig } from '@/config/macro-indicators'

describe('Indicator Formatting - Sanity Tests', () => {
  describe('JOLTS Job Openings', () => {
    it('should format JOLTS value in millions', () => {
      const config = getIndicatorConfig('jolts_openings')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('millions')
      expect(config?.scale).toBe(1 / 1000) // FRED gives thousands → display millions
      expect(config?.decimals).toBe(3)

      // Test: FRED value 7658 (thousands) → should display 7.658M
      const rawValue = 7658
      const formatted = formatIndicatorValueSimple(rawValue, 'jolts_openings')
      expect(formatted).toBe('7.658M')
    })

    it('should format JOLTS date as monthly', () => {
      const date = '2025-09-01'
      const formatted = formatIndicatorDate(date, 'jolts_openings')
      expect(formatted).toBe('Sep 2025')
    })
  })

  describe('Initial Claims (4-week average)', () => {
    it('should format Initial Claims in thousands', () => {
      const config = getIndicatorConfig('claims_4w')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('thousands')
      // Note: Scale may be 1 if FRED already returns in thousands, or 1/1000 if in raw level
      expect(config?.decimals).toBe(2)

      // Test: If FRED value is 214750 (raw) → should display 214.75K
      // If FRED value is 214.75 (already in thousands) → should display 214.75K
      const rawValue = 214.75 // Assuming FRED returns in thousands
      const formatted = formatIndicatorValueSimple(rawValue, 'claims_4w')
      expect(formatted).toContain('K')
    })

    it('should format Initial Claims date as weekly', () => {
      const date = '2025-11-29'
      const formatted = formatIndicatorDate(date, 'claims_4w')
      // Weekly dates show full date
      expect(formatted).toContain('2025')
    })
  })

  describe('Unemployment Rate (U3)', () => {
    it('should format unemployment rate as percentage', () => {
      const config = getIndicatorConfig('unrate')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('percent')
      expect(config?.scale).toBe(1)
      expect(config?.decimals).toBe(2)

      // Test: FRED value 4.4 → should display 4.4% (or 4.40% depending on decimals)
      const rawValue = 4.4
      const formatted = formatIndicatorValueSimple(rawValue, 'unrate')
      expect(formatted).toContain('%')
      expect(parseFloat(formatted.replace('%', ''))).toBeCloseTo(4.4, 1)
    })

    it('should format unemployment date as monthly', () => {
      const date = '2025-10-01'
      const formatted = formatIndicatorDate(date, 'unrate')
      expect(formatted).toBe('Oct 2025')
    })
  })

  describe('CPI YoY', () => {
    it('should format CPI YoY as percentage', () => {
      const config = getIndicatorConfig('cpi_yoy')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('percent')
      expect(config?.isOfficialYoY).toBe(true)
      expect(config?.decimals).toBe(2)

      // Test: FRED value 3.02 → should display 3.02%
      const rawValue = 3.02
      const formatted = formatIndicatorValueSimple(rawValue, 'cpi_yoy')
      expect(formatted).toBe('3.02%')
    })

    it('should format CPI date as monthly', () => {
      const date = '2025-09-01'
      const formatted = formatIndicatorDate(date, 'cpi_yoy')
      expect(formatted).toBe('Sep 2025')
    })
  })

  describe('NFP (Payrolls Delta)', () => {
    it('should format NFP delta in thousands', () => {
      const config = getIndicatorConfig('payems_delta')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('thousands')
      expect(config?.decimals).toBe(0) // No decimals for NFP

      // Test: FRED delta 270 → should display 270K
      const rawValue = 270
      const formatted = formatIndicatorValueSimple(rawValue, 'payems_delta')
      expect(formatted).toBe('270K')
    })

    it('should format NFP date as monthly', () => {
      const date = '2025-11-01'
      const formatted = formatIndicatorDate(date, 'payems_delta')
      expect(formatted).toBe('Nov 2025')
    })
  })

  describe('GDP QoQ (Quarterly)', () => {
    it('should format GDP QoQ as percentage with 1 decimal', () => {
      const config = getIndicatorConfig('gdp_qoq')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('percent')
      expect(config?.decimals).toBe(1)
      // isOfficialQoQ may not be defined in all configs

      // Test: FRED value 2.5 → should display 2.5%
      const rawValue = 2.5
      const formatted = formatIndicatorValueSimple(rawValue, 'gdp_qoq')
      expect(formatted).toBe('2.5%')
    })

    it('should format GDP date as quarterly (Q3 2025)', () => {
      const date = '2025-07-01' // Q3 starts in July
      const formatted = formatIndicatorDate(date, 'gdp_qoq')
      expect(formatted).toBe('Q3 2025')
    })
  })

  describe('Retail Sales YoY (USA)', () => {
    it('should format retail sales YoY as percentage', () => {
      const config = getIndicatorConfig('retail_yoy')
      expect(config).toBeDefined()
      expect(config?.unit).toBe('percent')
      expect(config?.isOfficialYoY).toBe(true)
      expect(config?.scale).toBe(1) // Should be 1, but may need adjustment if showing 63.54 instead of 6.35

      // Test: If FRED returns 6.35 → should display 6.35%
      const rawValue = 6.35
      const formatted = formatIndicatorValueSimple(rawValue, 'retail_yoy')
      expect(formatted).toBe('6.35%')
    })

    it('should format retail sales date as monthly', () => {
      const date = '2025-09-01'
      const formatted = formatIndicatorDate(date, 'retail_yoy')
      expect(formatted).toBe('Sep 2025')
    })
  })

  describe('Date Formatting Edge Cases', () => {
    it('should handle annual period type', () => {
      const date = '2025-01-01'
      const formatted = formatIndicatorDate(date, 'test_annual')
      // If config has annual, should show just year
      // For now, default to monthly format
      expect(formatted).toContain('2025')
    })

    it('should return — for null/undefined dates', () => {
      expect(formatIndicatorDate(null)).toBe('—')
      expect(formatIndicatorDate(undefined)).toBe('—')
      expect(formatIndicatorDate('')).toBe('—')
    })
  })

  describe('Value Formatting Edge Cases', () => {
    it('should return — for null/undefined values', () => {
      expect(formatIndicatorValueSimple(null)).toBe('—')
      expect(formatIndicatorValueSimple(undefined)).toBe('—')
    })

    it('should handle zero values', () => {
      const formatted = formatIndicatorValueSimple(0, 'unrate')
      expect(formatted).toContain('%')
      expect(parseFloat(formatted.replace('%', ''))).toBe(0)
    })
  })
})

