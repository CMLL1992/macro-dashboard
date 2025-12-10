/**
 * API endpoint para obtener estado de jobs
 * Accesible desde Client Components usando rutas relativas
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10 // Timeout máximo de 10 segundos

import { NextResponse } from 'next/server'
import { getJobStatusData } from '@/lib/job-status-data'

// Headers CORS para permitir acceso desde el cliente
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

export async function GET() {
  try {
    const status = await getJobStatusData()
    
    return NextResponse.json(status, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    console.error('[api/status/jobs] Unexpected error:', error)
    
    // Retornar respuesta de error válida
    return NextResponse.json(
      {
        calendar: {
          last_success_at: null,
          last_error_at: null,
          status: 'error' as const,
        },
        releases: {
          last_success_at: null,
          last_error_at: null,
          status: 'error' as const,
        },
        bias: {
          last_updated_at: null,
          status: 'error' as const,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
}

// Handler para preflight OPTIONS (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

