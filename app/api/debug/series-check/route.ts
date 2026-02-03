/**
 * Debug endpoint: Quick series ID verification
 * GET /api/debug/series-check?source=fred&id=GBRCPIALLMINMEI
 * 
 * Returns: ok, last_value, last_date, errorType
 * Useful for validating new series IDs before adding to config
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/utils/http'
import { logger } from '@/lib/obs/logger'
import { generateRequestId } from '@/lib/obs/request-id'

const FRED_API_KEY = process.env.FRED_API_KEY || ''
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations'

export async function GET(request: NextRequest) {
  // Allow in localhost only
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  
  if (!isLocalhost) {
    return NextResponse.json(
      { error: 'This endpoint is only available in localhost' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'fred'
  const seriesId = searchParams.get('id') || ''

  if (!seriesId) {
    return NextResponse.json(
      { error: 'Missing required parameter: id' },
      { status: 400 }
    )
  }

  const requestId = generateRequestId()

  try {
    if (source === 'fred') {
      if (!FRED_API_KEY) {
        return NextResponse.json({
          ok: false,
          errorType: 'MISCONFIG',
          error: 'FRED_API_KEY not configured',
        })
      }

      // Fetch latest observation from FRED
      // Use limit=1 and sort_order=desc to get the most recent observation
      const url = `${FRED_BASE_URL}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc&observation_start=2020-01-01`
      
      logger.info('series-check: Fetching from FRED', {
        requestId,
        source: 'fred',
        seriesId,
        url: url.replace(FRED_API_KEY, '***'),
      })

      const response = await fetchWithTimeout(url, {
        revalidateHours: 0, // Always fresh for verification
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        logger.warn('series-check: FRED API error', {
          requestId,
          source: 'fred',
          seriesId,
          httpStatus: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200),
        })

        return NextResponse.json({
          ok: false,
          errorType: response.status === 400 ? 'MISCONFIG' : response.status === 404 ? 'NO_DATA' : 'SOURCE_DOWN',
          error: `FRED API error: ${response.status} ${response.statusText}`,
          httpStatus: response.status,
        })
      }

      const data = await response.json()

      if (!data.observations || data.observations.length === 0) {
        return NextResponse.json({
          ok: false,
          errorType: 'NO_DATA',
          error: 'No observations found for this series',
        })
      }

      const latest = data.observations[0]
      const value = latest.value === '.' ? null : parseFloat(latest.value)

      return NextResponse.json({
        ok: true,
        source: 'fred',
        seriesId,
        lastValue: value,
        lastDate: latest.date,
        observationCount: data.observations.length,
        seriesTitle: data.series_title || 'Unknown',
      })
    } else if (source === 'oecd') {
      // OECD verification would require dataset and filter
      // For now, return not implemented
      return NextResponse.json({
        ok: false,
        errorType: 'NOT_IMPLEMENTED',
        error: 'OECD verification not yet implemented. Use FRED for now.',
      })
    } else {
      return NextResponse.json({
        ok: false,
        errorType: 'INVALID_SOURCE',
        error: `Unknown source: ${source}. Supported: fred, oecd`,
      })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('series-check: Exception', {
      requestId,
      source,
      seriesId,
      error: errorMsg,
    })

    return NextResponse.json({
      ok: false,
      errorType: 'EXCEPTION',
      error: errorMsg,
    }, { status: 500 })
  }
}
