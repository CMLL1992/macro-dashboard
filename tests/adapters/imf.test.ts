/**
 * IMF adapter tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import imfFixture from '../fixtures/imf/ifs_cpi_usa_m.json'

// Mock fetch
global.fetch = vi.fn()

describe('fetchIMFSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return MacroSeries with correct shape', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => imfFixture,
    })

    const result = await fetchIMFSeries({
      flow: 'IFS',
      key: 'PCPIPCH.USA.A',
      freq: 'A',
    })

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('source', 'IMF')
    expect(result).toHaveProperty('indicator')
    expect(result).toHaveProperty('nativeId')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('frequency', 'A')
    expect(result).toHaveProperty('data')
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('should normalize dates by frequency', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => imfFixture,
    })

    const result = await fetchIMFSeries({
      flow: 'IFS',
      key: 'PCPIPCH.USA.A',
      freq: 'A',
    })

    expect(result.data.length).toBeGreaterThan(0)
    result.data.forEach((point) => {
      expect(point.date).toMatch(/^\d{4}-12-31$/)
    })
  })

  it('should return data sorted in ascending order', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => imfFixture,
    })

    const result = await fetchIMFSeries({
      flow: 'IFS',
      key: 'PCPIPCH.USA.A',
      freq: 'A',
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
        data: { datasets: [] },
      }),
    })

    const result = await fetchIMFSeries({
      flow: 'IFS',
      key: 'INVALID.KEY',
      freq: 'A',
    })

    expect(result.data).toEqual([])
    expect(result.meta?.reason).toBe('NO_DATA')
  })
})
