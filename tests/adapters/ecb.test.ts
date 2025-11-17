/**
 * ECB adapter tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchECBSeries } from '@/lib/datasources/ecb'
import ecbFixture from '../fixtures/ecb/exr_eurusd_d.json'

// Mock fetch
global.fetch = vi.fn()

describe('fetchECBSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return MacroSeries with correct shape', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ecbFixture,
    })

    const result = await fetchECBSeries({
      flow: 'EXR',
      key: 'D.USD.EUR.SP00.A',
      freq: 'D',
    })

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('source', 'ECB_SDW')
    expect(result).toHaveProperty('indicator')
    expect(result).toHaveProperty('nativeId')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('frequency', 'D')
    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('should normalize dates by frequency', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ecbFixture,
    })

    const result = await fetchECBSeries({
      flow: 'EXR',
      key: 'D.USD.EUR.SP00.A',
      freq: 'D',
    })

    expect(result.data.length).toBeGreaterThan(0)
    result.data.forEach((point) => {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('should return data sorted in ascending order', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ecbFixture,
    })

    const result = await fetchECBSeries({
      flow: 'EXR',
      key: 'D.USD.EUR.SP00.A',
      freq: 'D',
    })

    expect(result.data.length).toBeGreaterThan(1)
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].date >= result.data[i - 1].date).toBe(true)
    }
  })

  it('should handle NO_DATA case', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        structure: {},
        dataSets: [],
      }),
    })

    const result = await fetchECBSeries({
      flow: 'EXR',
      key: 'INVALID.KEY',
      freq: 'D',
    })

    expect(result.data).toEqual([])
    expect(result.meta?.reason).toBe('NO_DATA')
  })
})
