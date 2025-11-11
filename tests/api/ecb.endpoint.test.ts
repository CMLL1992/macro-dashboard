/**
 * ECB endpoint tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/macro/ecb/route'
import { fetchECBSeries } from '@/lib/datasources/ecb'

vi.mock('@/lib/datasources/ecb')

describe('GET /api/macro/ecb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with default params', async () => {
    const mockSeries = {
      id: 'ECB_SDW:EXR:D.USD.EUR.SP00.A',
      source: 'ECB_SDW' as const,
      indicator: 'D.USD.EUR.SP00.A',
      nativeId: 'EXR:D.USD.EUR.SP00.A',
      name: 'ECB Exchange Rates',
      frequency: 'D' as const,
      data: [
        { date: '2024-01-12', value: 1.0935 },
        { date: '2024-01-13', value: 1.0940 },
        { date: '2024-01-14', value: 1.0945 },
        { date: '2024-01-15', value: 1.0950 },
      ],
      lastUpdated: '2024-01-15',
    }

    vi.mocked(fetchECBSeries).mockResolvedValueOnce(mockSeries)

    const request = new NextRequest('http://localhost:3000/api/macro/ecb')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('id')
    expect(json).toHaveProperty('source', 'ECB_SDW')
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
    expect(fetchECBSeries).toHaveBeenCalledWith({
      flow: 'EXR',
      key: 'D.USD.EUR.SP00.A',
      freq: 'D',
    })
  })

  it('should return 400 for invalid frequency', async () => {
    const url = new URL('http://localhost:3000/api/macro/ecb')
    url.searchParams.set('freq', 'X')
    const request = new NextRequest(url)
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toHaveProperty('error')
    expect(fetchECBSeries).not.toHaveBeenCalled()
  })

  it('should return 503 on external service error', async () => {
    vi.mocked(fetchECBSeries).mockRejectedValueOnce(
      new Error('ECB_SDW 500: Internal Server Error')
    )

    const request = new NextRequest('http://localhost:3000/api/macro/ecb')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json).toHaveProperty('error', 'External service error')
    expect(json).toHaveProperty('message')
  })
})
