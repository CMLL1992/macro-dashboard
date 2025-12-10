import { NextResponse } from "next/server"
import path from "path"
import { getDB } from "@/lib/db/schema"
import { getUnifiedDB, isUsingTurso } from "@/lib/db/unified-db"

export async function GET() {
  try {
    // Get database path info
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'macro.db')
    const resolvedPath = path.resolve(dbPath)
    
    // Get database instance based on type
    let row: any = null
    let dbType = 'unknown'
    
    if (isUsingTurso()) {
      dbType = 'turso'
      const db = getUnifiedDB()
      const result = await db.prepare(
        `SELECT series_id, COUNT(*) AS n, MAX(date) AS max_date
         FROM macro_observations
         WHERE series_id = 'T10Y2Y'
         GROUP BY series_id`
      ).get()
      row = result
    } else {
      dbType = 'sqlite'
      const db = getDB()
      row = db.prepare(
        `SELECT series_id, COUNT(*) AS n, MAX(date) AS max_date
         FROM macro_observations
         WHERE series_id = 'T10Y2Y'
         GROUP BY series_id`
      ).get() as any
    }
    
    return NextResponse.json({
      dbType,
      dbPath,
      resolvedPath,
      processCwd: process.cwd(),
      databasePathEnv: process.env.DATABASE_PATH || 'NOT SET',
      tursoDatabaseUrl: process.env.TURSO_DATABASE_URL ? 'SET' : 'NOT SET',
      tursoAuthToken: process.env.TURSO_AUTH_TOKEN ? 'SET' : 'NOT SET',
      isUsingTurso: isUsingTurso(),
      info: row || { error: 'No data found for T10Y2Y' },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
