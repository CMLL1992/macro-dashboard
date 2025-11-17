/**
 * World Bank adapter tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import worldBankFixture from '../fixtures/worldbank/cpi_usa.json'

// Mock fetch
global.fetch = vi.fn()

describe('fetchWorldBankSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return MacroSeries with correct shape', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => worldBankFixture,
    })

    const result = await fetchWorldBankSeries({
      countryISO3: 'USA',
      indicatorCode: 'FP.CPI.TOTL.ZG',
    })

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('source', 'WORLD_BANK')
    expect(result).toHaveProperty('indicator')
    expect(result).toHaveProperty('nativeId')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('frequency', 'A')
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('country', 'USA')
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('should normalize dates to YYYY-12-31 format', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => worldBankFixture,
    })

    const result = await fetchWorldBankSeries({
      countryISO3: 'USA',
      indicatorCode: 'FP.CPI.TOTL.ZG',
    })

    expect(result.data.length).toBeGreaterThan(0)
    result.data.forEach((point) => {
      expect(point.date).toMatch(/^\d{4}-12-31$/)
    })
  })

  it('should return data sorted in ascending order', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => worldBankFixture,
    })

    const result = await fetchWorldBankSeries({
      countryISO3: 'USA',
      indicatorCode: 'FP.CPI.TOTL.ZG',
    })

    expect(result.data.length).toBeGreaterThan(1)
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].date >= result.data[i - 1].date).toBe(true)
    }
  })

  it('should filter out null values', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => worldBankFixture,
    })

    const result = await fetchWorldBankSeries({
      countryISO3: 'USA',
      indicatorCode: 'FP.CPI.TOTL.ZG',
    })

    result.data.forEach((point) => {
      expect(point.value).not.toBeNull()
      expect(point.value).not.toBeUndefined()
      expect(typeof point.value).toBe('number')
      expect(Number.isFinite(point.value)).toBe(true)
    })
  })
})
