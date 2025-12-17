/**
 * Test script to verify yoy() fix works correctly
 * Tests with real data from Turso
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { yoy } from '@/lib/fred'
import type { SeriesPoint } from '@/lib/fred'

async function testYoY() {
  console.log('Testing yoy() fix with real data from Turso...\n')
  
  const db = getUnifiedDB()
  const seriesId = 'CPIAUCSL'
  
  // Get observations from Turso
  const result = await db.prepare(
    'SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date ASC'
  ).all(seriesId) as Array<{ date: string; value: number }>
  
  console.log(`Found ${result.length} observations for ${seriesId}`)
  console.log(`First 3 dates:`, result.slice(0, 3).map(r => r.date))
  console.log(`Last 3 dates:`, result.slice(-3).map(r => r.date))
  console.log(`\nLast observation:`, result[result.length - 1])
  
  // Check if we have data from previous year
  const lastDate = result[result.length - 1]?.date
  if (lastDate) {
    const year = parseInt(lastDate.slice(0, 4))
    const month = lastDate.slice(5, 7)
    const prevYearDate = `${year - 1}-${month}-01`
    const prevYearData = result.filter(r => r.date.startsWith(`${year - 1}-${month}`))
    console.log(`\nLooking for previous year data (${prevYearDate}):`)
    console.log(`Found ${prevYearData.length} observations in ${year - 1}-${month}`)
    if (prevYearData.length > 0) {
      console.log(`Previous year data:`, prevYearData)
    }
  }
  
  // Convert to SeriesPoint format
  const series: SeriesPoint[] = result.map(r => ({ date: r.date, value: r.value }))
  
  // Test yoy() function
  console.log('\n--- Testing yoy() function ---')
  const yoyResult = yoy(series)
  console.log(`yoy() returned ${yoyResult.length} results`)
  
  if (yoyResult.length > 0) {
    console.log(`\nLast 3 YoY results:`)
    yoyResult.slice(-3).forEach(r => {
      console.log(`  ${r.date}: ${r.value.toFixed(2)}%`)
    })
    console.log(`\n✅ YoY calculation works! Latest YoY: ${yoyResult[yoyResult.length - 1]?.value.toFixed(2)}%`)
  } else {
    console.log(`\n❌ yoy() returned empty array`)
    console.log(`\nDebugging: Checking month alignment...`)
    
    // Debug: Check month keys
    const byMonth = new Map<string, { date: string; value: number }>()
    for (const p of series.slice(-12)) {
      const yearMonth = p.date.slice(0, 7)
      const monthKey = `${yearMonth}-01`
      const existing = byMonth.get(monthKey)
      if (!existing || p.date > existing.date) {
        byMonth.set(monthKey, { date: p.date, value: p.value })
      }
    }
    console.log(`Last 12 months (normalized):`)
    Array.from(byMonth.entries()).slice(-12).forEach(([key, val]) => {
      console.log(`  ${key} (from ${val.date}): ${val.value}`)
    })
  }
}

testYoY().catch(console.error)
