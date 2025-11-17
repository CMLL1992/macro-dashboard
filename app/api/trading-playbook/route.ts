import { NextResponse } from 'next/server'
import getTradingPlaybook from '@/domain/macro-engine/trading-playbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/trading-playbook
 * Returns automated trading playbook based on Macro Engine state
 */
export async function GET() {
  try {
    const playbook = await getTradingPlaybook()

    // Convert Date to ISO string for JSON serialization
    return NextResponse.json({
      ...playbook,
      updatedAt: playbook.updatedAt.toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to generate trading playbook',
      },
      { status: 500 }
    )
  }
}

