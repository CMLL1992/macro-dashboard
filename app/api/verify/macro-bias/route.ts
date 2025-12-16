/**
 * Endpoint para verificar que macro_bias tiene exactamente los 19 símbolos permitidos
 * GET /api/verify/macro-bias
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getAllowedPairs } from '@/config/tactical-pairs'

export async function GET() {
  try {
    // Obtener símbolos permitidos
    const allowedPairs = getAllowedPairs()
    const allowedSet = new Set(allowedPairs.map(s => s.toUpperCase()))

    // Consultar macro_bias
    const db = getUnifiedDB()
    const isTurso = isUsingTurso()

    let rows: Array<{ symbol: string }>
    if (isTurso) {
      rows = await db.prepare('SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol').all() as Array<{ symbol: string }>
    } else {
      const { getDB } = await import('@/lib/db/schema')
      const sqliteDb = getDB()
      rows = sqliteDb.prepare('SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol').all() as Array<{ symbol: string }>
    }

    const symbolsInDb = rows.map(r => r.symbol.toUpperCase()).sort()

    // Verificar
    const extraSymbols = symbolsInDb.filter(s => !allowedSet.has(s))
    const missingSymbols = allowedPairs.filter(s => !symbolsInDb.includes(s.toUpperCase()))

    const isValid = extraSymbols.length === 0 && missingSymbols.length === 0 && symbolsInDb.length === allowedPairs.length

    return NextResponse.json({
      valid: isValid,
      summary: {
        totalInDb: symbolsInDb.length,
        totalAllowed: allowedPairs.length,
        matches: symbolsInDb.length === allowedPairs.length,
      },
      symbolsInDb,
      allowedPairs: allowedPairs.sort(),
      issues: {
        extraSymbols,
        missingSymbols,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
