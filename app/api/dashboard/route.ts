export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/dashboard-data'

export async function GET() {
  try {
    const data = await getDashboardData()
    return NextResponse.json(
      { ok: true, data },
      { 
        headers: { 
          'Cache-Control': 's-maxage=10800',
          'Content-Type': 'application/json'
        } 
      }
    )
  } catch (error) {
    console.error('[api/dashboard] Error:', error)
    
    // Devuelve respuesta de error controlada
    return NextResponse.json(
      {
        ok: false,
        error: 'Dashboard data unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      },
    )
  }
}


