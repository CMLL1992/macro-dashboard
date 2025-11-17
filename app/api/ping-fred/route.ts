export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAllLatest } from '@/lib/fred'

export async function GET() {
  try {
    const data = await getAllLatest()
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    // Aun si algo global falla, respondemos con estructura clara
    return NextResponse.json({ ok: false, error: 'unexpected', details: String(e) }, { status: 500 })
  }
}


