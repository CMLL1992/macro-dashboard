/**
 * Simulate trigger alerts for testing
 * POST /api/alerts/simulate
 * 
 * Simulates trigger execution without affecting production state
 * Requires authentication and ENABLE_TELEGRAM_TESTS=true
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkUSDChange } from '@/lib/alerts/triggers'
import { checkCorrelationChanges } from '@/lib/alerts/triggers'
import { checkMacroReleases } from '@/lib/alerts/triggers'
import { loadAlertState, saveAlertState } from '@/lib/alerts/state'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Validates that the request comes from the Admin panel
 */
function isAuthenticatedFromAdmin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')
  if (origin && host) {
    const originHost = new URL(origin).host
    if (originHost !== host) return false
  }
  if (referer && !referer.includes('/admin')) return false
  return true
}

export async function POST(request: NextRequest) {
  // Security: check if tests are enabled FIRST
  if (process.env.ENABLE_TELEGRAM_TESTS !== 'true') {
    return NextResponse.json(
      { ok: false, error: 'TEST_MODE_DISABLED' },
      { status: 403 }
    )
  }

  // Security: validate same-origin from Admin panel
  if (!isAuthenticatedFromAdmin(request)) {
    return NextResponse.json(
      { ok: false, error: 'NOT_AUTHENTICATED' },
      { status: 401 }
    )
  }

  // Security: in production, require test chat ID
  if (isProduction && !process.env.TELEGRAM_TEST_CHAT_ID) {
    return NextResponse.json(
      { ok: false, error: 'TEST_CHAT_MISSING' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    // In production, force persist=false
    const persist = isProduction ? false : (body.persist || false)
    
    // Validate persist in production
    if (isProduction && body.persist === true) {
      return NextResponse.json(
        { ok: false, error: 'Cannot persist changes in production. Set persist=false' },
        { status: 403 }
      )
    }
    const { type, ...payload } = body

    if (!type || !['usd', 'correlations', 'macro'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: usd, correlations, or macro' },
        { status: 400 }
      )
    }

    // Save original state if not persisting
    let originalState = null
    if (!persist) {
      originalState = await loadAlertState()
    }

    let result: any = {}

    try {
      switch (type) {
        case 'usd': {
          const { prevUSD, currentUSD, regime, score, latestDataDate, categoryChips } = payload
          if (!currentUSD || !regime || score === undefined) {
            return NextResponse.json(
              { error: 'Missing required fields: currentUSD, regime, score' },
              { status: 400 }
            )
          }

          // Temporarily set state for simulation
          if (!persist) {
            const tempState = loadAlertState()
            saveAlertState({ usdBias: prevUSD || null })
          }

          await checkUSDChange(
            currentUSD,
            regime,
            score,
            latestDataDate || null,
            categoryChips || ''
          )

          result = { type: 'usd', simulated: true }
          break
        }

        case 'correlations': {
          const { correlations } = payload
          if (!Array.isArray(correlations)) {
            return NextResponse.json(
              { error: 'correlations must be an array' },
              { status: 400 }
            )
          }

          await checkCorrelationChanges(correlations)
          result = { type: 'correlations', count: correlations.length }
          break
        }

        case 'macro': {
          const { observations } = payload
          if (!Array.isArray(observations)) {
            return NextResponse.json(
              { error: 'observations must be an array' },
              { status: 400 }
            )
          }

          await checkMacroReleases(observations)
          result = { type: 'macro', count: observations.length }
          break
        }
      }

      // Restore original state if not persisting
      if (!persist && originalState) {
        saveAlertState(originalState)
      }

      return NextResponse.json({
        success: true,
        ...result,
        persist,
        message: `Trigger ${type} simulated successfully`,
      })
    } catch (triggerError) {
      // Restore state on error
      if (!persist && originalState) {
        saveAlertState(originalState)
      }
      throw triggerError
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[API] Simulate endpoint error:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

