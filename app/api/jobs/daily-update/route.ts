/**
 * Daily update job - Updates FRED data, correlations, and bias
 * Runs daily at 6:00 AM UTC via Vercel Cron
 */

import { NextRequest, NextResponse } from 'next/server'

const CRON_TOKEN = process.env.CRON_TOKEN

function validateCronToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === CRON_TOKEN
}

export async function GET(request: NextRequest) {
  // Validate cron token
  if (!validateCronToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const results: any = {
    success: true,
    startedAt,
    steps: [],
  }

  try {
    // Step 1: Update FRED data
    try {
      const fredResponse = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/jobs/ingest/fred`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRON_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      const fredData = await fredResponse.json()
      results.steps.push({
        name: 'fred_ingest',
        success: fredResponse.ok,
        data: fredData,
      })
    } catch (error: any) {
      results.steps.push({
        name: 'fred_ingest',
        success: false,
        error: error.message,
      })
    }

    // Wait 2 seconds between steps
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 2: Calculate correlations
    try {
      const corrResponse = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/jobs/correlations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRON_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      const corrData = await corrResponse.json()
      results.steps.push({
        name: 'correlations',
        success: corrResponse.ok,
        data: corrData,
      })
    } catch (error: any) {
      results.steps.push({
        name: 'correlations',
        success: false,
        error: error.message,
      })
    }

    // Wait 2 seconds between steps
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 3: Calculate bias
    try {
      const biasResponse = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/jobs/compute/bias`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRON_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      const biasData = await biasResponse.json()
      results.steps.push({
        name: 'bias',
        success: biasResponse.ok,
        data: biasData,
      })
    } catch (error: any) {
      results.steps.push({
        name: 'bias',
        success: false,
        error: error.message,
      })
    }

    const finishedAt = new Date().toISOString()
    results.finishedAt = finishedAt
    results.duration_ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    // Check if all steps succeeded
    const allSucceeded = results.steps.every((step: any) => step.success)
    results.success = allSucceeded

    return NextResponse.json(results, { status: allSucceeded ? 200 : 207 }) // 207 = Multi-Status
  } catch (error: any) {
    const finishedAt = new Date().toISOString()
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        startedAt,
        finishedAt,
        duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export const POST = GET

