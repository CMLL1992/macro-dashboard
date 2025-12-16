/**
 * Script para probar llamadas a TradingEconomics fuera del job
 * Uso: npx tsx scripts/test-tradingeconomics.ts
 */

import { config } from 'dotenv'
import { fetchTradingEconomics } from '../packages/ingestors/tradingeconomics'

config()

async function testIndicator(indicatorId: string, series: string, description: string) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Testing: ${indicatorId}`)
  console.log(`Description: ${description}`)
  console.log(`Series: ${series}`)
  console.log(`${'='.repeat(80)}\n`)

  const apiKey = process.env.TRADING_ECONOMICS_API_KEY
  if (!apiKey) {
    console.error('❌ TRADING_ECONOMICS_API_KEY not found in environment')
    return
  }

  console.log(`API Key length: ${apiKey.length} characters`)

  try {
    console.log(`\n📡 Fetching data from TradingEconomics...`)
    const observations = await fetchTradingEconomics(series, apiKey, 'euro area')
    
    console.log(`\n✅ Success! Received ${observations.length} observations`)
    
    if (observations.length > 0) {
      console.log(`\n📊 Latest 5 observations:`)
      observations.slice(0, 5).forEach((obs, i) => {
        console.log(`  ${i + 1}. Date: ${obs.date}, Value: ${obs.value}`)
      })
      
      const latest = observations[0]
      console.log(`\n📅 Latest data point:`)
      console.log(`  Date: ${latest.date}`)
      console.log(`  Value: ${latest.value}`)
      console.log(`  Released at: ${latest.released_at || 'N/A'}`)
      
      // Verificar si la fecha es reciente (2024 o 2025)
      const latestDate = new Date(latest.date)
      const year = latestDate.getFullYear()
      if (year >= 2024) {
        console.log(`\n✅ Data is recent (${year})`)
      } else {
        console.log(`\n⚠️  Data is outdated (${year}, expected 2024-2025)`)
      }
    } else {
      console.log(`\n⚠️  No observations returned`)
    }
  } catch (error: any) {
    console.error(`\n❌ Error fetching data:`)
    console.error(`  Type: ${error.type || 'UNKNOWN'}`)
    console.error(`  Status: ${error.statusCode || 'N/A'}`)
    console.error(`  Message: ${error.message || String(error)}`)
    console.error(`  Endpoint: ${error.endpoint || 'N/A'}`)
    console.error(`  Symbol: ${error.symbol || 'N/A'}`)
    console.error(`  Date range: ${error.dateRange || 'N/A'}`)
    console.error(`  Response body: ${error.responseBody?.substring(0, 500) || 'N/A'}`)
  }
}

async function main() {
  console.log('🧪 TradingEconomics API Test Script')
  console.log('Testing EU_RETAIL_SALES_YOY and EU_INDUSTRIAL_PRODUCTION_YOY\n')

  // Test 1: Retail Sales YoY
  await testIndicator(
    'EU_RETAIL_SALES_YOY',
    'retail sales yoy',
    'Ventas Minoristas Eurozona (YoY)'
  )

  // Esperar 3 segundos entre tests para evitar rate limiting
  console.log('\n⏳ Waiting 3 seconds before next test...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Test 2: Industrial Production YoY
  await testIndicator(
    'EU_INDUSTRIAL_PRODUCTION_YOY',
    'industrial production yoy',
    'Producción Industrial Eurozona (YoY)'
  )

  console.log('\n✅ All tests completed')
}

main().catch(console.error)









