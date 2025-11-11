/**
 * IMF endpoint tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/macro/imf/route'
import { fetchIMFSeries } from '@/lib/datasources/imf'

vi.mock('@/lib/datasources/imf')

describe('GET /api/macro/imf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with default params', async () => {
    const mockSeries = {
      id: 'IMF:IFS:PCPIPCH.USA.A',
      source: 'IMF' as const,
      indicator: 'PCPIPCH.USA.A',
      nativeId: 'IFS:PCPIPCH.USA.A',
      name: 'Consumer Price Index, All items, Percent change, Annual',
      frequency: 'A' as const,
      data: [
        { date: '2020-12-31', value: 1.2 },
        { date: '2021-12-31', value: 4.7 },
        { date: '2022-12-31', value: 8.0 },
        { date: '2023-12-31', value: 3.2 },
      ],
      lastUpdated: '2023-12-31',
    }

    vi.mocked(fetchIMFSeries).mockResolvedValueOnce(mockSeries)

    const request = new NextRequest('http://localhost:3000/api/macro/imf')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('id')
    expect(json).toHaveProperty('source', 'IMF')
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
    expect(fetchIMFSeries).toHaveBeenCalledWith({
      flow: 'IFS',
      key: 'PCPIPCH.USA.A',
      freq: 'A',
    })
  })

  it('should return 400 for invalid frequency', async () => {
    const url = new URL('http://localhost:3000/api/macro/imf')
    url.searchParams.set('freq', 'X')
    const request = new NextRequest(url)
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toHaveProperty('error')
    expect(fetchIMFSeries).not.toHaveBeenCalled()
  })

  it('should return 503 on external service error', async () => {
    vi.mocked(fetchIMFSeries).mockRejectedValueOnce(
      new Error('IMF 500: Internal Server Error')
    )

    const request = new NextRequest('http://localhost:3000/api/macro/imf')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json).toHaveProperty('error', 'External service error')
    expect(json).toHaveProperty('message')
  })
})
