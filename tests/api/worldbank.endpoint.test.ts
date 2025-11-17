/**
 * World Bank endpoint tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/macro/worldbank/route'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import worldBankFixture from '../fixtures/worldbank/cpi_usa.json'

vi.mock('@/lib/datasources/worldbank')

describe('GET /api/macro/worldbank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with default params', async () => {
    const mockSeries = {
      id: 'WORLD_BANK:FP.CPI.TOTL.ZG:USA',
      source: 'WORLD_BANK' as const,
      indicator: 'FP.CPI.TOTL.ZG',
      nativeId: 'USA:FP.CPI.TOTL.ZG',
      name: 'Inflation, consumer prices (annual %)',
      frequency: 'A' as const,
      country: 'USA',
      data: [
        { date: '2020-12-31', value: 1.2 },
        { date: '2021-12-31', value: 4.7 },
        { date: '2022-12-31', value: 8.0 },
        { date: '2023-12-31', value: 3.2 },
      ],
      lastUpdated: '2023-12-31',
    }

    vi.mocked(fetchWorldBankSeries).mockResolvedValueOnce(mockSeries)

    const request = new NextRequest('http://localhost:3000/api/macro/worldbank')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('id')
    expect(json).toHaveProperty('source', 'WORLD_BANK')
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
    expect(fetchWorldBankSeries).toHaveBeenCalledWith({
      countryISO3: 'USA',
      indicatorCode: 'FP.CPI.TOTL.ZG',
    })
  })

  it('should return 400 for invalid country code', async () => {
    const url = new URL('http://localhost:3000/api/macro/worldbank')
    url.searchParams.set('country', 'US')
    const request = new NextRequest(url)
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toHaveProperty('error')
    expect(fetchWorldBankSeries).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid indicator code', async () => {
    const url = new URL('http://localhost:3000/api/macro/worldbank')
    url.searchParams.set('indicator', 'INVALID@CODE')
    const request = new NextRequest(url)
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toHaveProperty('error')
    expect(fetchWorldBankSeries).not.toHaveBeenCalled()
  })

  it('should return 503 on external service error', async () => {
    vi.mocked(fetchWorldBankSeries).mockRejectedValueOnce(
      new Error('WorldBank 500: Internal Server Error')
    )

    const request = new NextRequest('http://localhost:3000/api/macro/worldbank')
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json).toHaveProperty('error', 'External service error')
    expect(json).toHaveProperty('message')
  })
})
