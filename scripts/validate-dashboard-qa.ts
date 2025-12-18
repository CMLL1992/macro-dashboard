#!/usr/bin/env tsx
/**
 * Script de validación QA para Dashboard Macro Trading
 * 
 * Ejecuta todos los checks del checklist de QA y genera un reporte.
 * 
 * Uso:
 *   pnpm tsx scripts/validate-dashboard-qa.ts [--url=http://localhost:3001]
 * 
 * Variables de entorno:
 *   DASHBOARD_URL - URL base del dashboard (default: http://localhost:3001)
 */

import 'dotenv/config'

interface ValidationResult {
  section: string
  passed: boolean
  warnings: string[]
  errors: string[]
  details?: any
}

interface DashboardResponse {
  ok?: boolean
  data?: {
    indicators?: any[]
    regime?: any
    regimes?: Record<string, any>
    scenarios?: any
    tacticalPairs?: any[]
    pairs?: any[]
    coverage?: Record<string, { total: number; withData: number; percentage: number }>
    lastUpdate?: string
    [key: string]: any // Permitir otras propiedades
  }
  error?: string
  message?: string
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3001'

async function fetchDashboard(): Promise<DashboardResponse> {
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/dashboard`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const json = await response.json()
    
    // Handle response format: { ok: true, data: {...} } or just { data: {...} }
    if (json.ok === false) {
      throw new Error(json.error || json.message || 'Dashboard returned error')
    }
    
    return json
  } catch (error) {
    console.error('❌ Error fetching dashboard:', error)
    throw error
  }
}

function validateCoverage(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '1. Cobertura de Datos',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  // Check lastUpdate timestamp
  const lastUpdate = data.lastUpdate
  if (!lastUpdate) {
    result.passed = false
    result.errors.push('❌ Timestamp de última actualización ausente')
  } else {
    const updateDate = new Date(lastUpdate)
    const now = new Date()
    const hoursAgo = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursAgo > 24) {
      result.passed = false
      result.errors.push(`❌ Última actualización hace ${Math.round(hoursAgo)} horas (muy antigua)`)
    } else if (hoursAgo > 2) {
      result.warnings.push(`⚠️ Última actualización hace ${Math.round(hoursAgo)} horas`)
    } else {
      result.details = { lastUpdate, hoursAgo: Math.round(hoursAgo * 10) / 10 }
    }
  }

  // Check coverage by currency
  const coverage = data.coverage
  if (!coverage) {
    result.warnings.push('⚠️ Información de cobertura no disponible')
  } else {
    const currencies = Object.keys(coverage)
    if (currencies.length === 0) {
      result.passed = false
      result.errors.push('❌ No hay cobertura por moneda')
    } else {
      result.details = { ...result.details, coverage }
      
      for (const [currency, stats] of Object.entries(coverage)) {
        if (stats.percentage < 50) {
          result.passed = false
          result.errors.push(`❌ ${currency}: Solo ${stats.percentage}% de cobertura (${stats.withData}/${stats.total})`)
        } else if (stats.percentage < 80) {
          result.warnings.push(`⚠️ ${currency}: ${stats.percentage}% de cobertura (baja)`)
        }
        
        if (stats.withData === 0 && stats.total > 0) {
          result.passed = false
          result.errors.push(`❌ ${currency}: 0 indicadores con datos de ${stats.total} totales`)
        }
      }
    }
  }

  // Check indicators for nulls
  const indicators = data.indicators || []
  const nullCount = indicators.filter((ind: any) => ind.value === null || ind.value === undefined).length
  const totalCount = indicators.length
  
  if (nullCount > 0) {
    const nullPercentage = (nullCount / totalCount) * 100
    if (nullPercentage > 30) {
      result.passed = false
      result.errors.push(`❌ ${nullCount}/${totalCount} indicadores con valor null (${Math.round(nullPercentage)}%)`)
    } else if (nullPercentage > 10) {
      result.warnings.push(`⚠️ ${nullCount}/${totalCount} indicadores con valor null (${Math.round(nullPercentage)}%)`)
    }
    result.details = { ...result.details, nullIndicators: nullCount, totalIndicators: totalCount }
  }

  return result
}

function validateRegime(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '2. Régimen Actual del Mercado',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  const regime = data.regime
  if (!regime) {
    result.passed = false
    result.errors.push('❌ Régimen actual no disponible')
    return result
  }

  // Check regime type
  const type = regime.type || regime.regime
  if (!type || type === 'Unknown' || type === 'Neutral') {
    result.warnings.push(`⚠️ Régimen es "${type}" (puede indicar inputs null)`)
  }
  result.details = { type }

  // Check timestamp
  const calculatedAt = regime.calculatedAt || regime.timestamp
  if (!calculatedAt) {
    result.warnings.push('⚠️ Timestamp de cálculo ausente')
  } else {
    const calcDate = new Date(calculatedAt)
    const now = new Date()
    const hoursAgo = (now.getTime() - calcDate.getTime()) / (1000 * 60 * 60)
    if (hoursAgo > 24) {
      result.warnings.push(`⚠️ Régimen calculado hace ${Math.round(hoursAgo)} horas`)
    }
    result.details = { ...result.details, calculatedAt, hoursAgo: Math.round(hoursAgo * 10) / 10 }
  }

  // Check confidence/score
  const confidence = regime.confidence || regime.score
  if (confidence === undefined || confidence === null) {
    result.warnings.push('⚠️ Confianza/score del régimen ausente')
  } else {
    result.details = { ...result.details, confidence }
  }

  // Check inputs
  const inputs = regime.inputs
  if (!inputs || Object.keys(inputs).length === 0) {
    result.warnings.push('⚠️ Inputs del régimen no visibles')
  } else {
    const inputKeys = Object.keys(inputs)
    result.details = { ...result.details, inputCount: inputKeys.length, inputs: inputKeys }
    
    // Check for null inputs
    const nullInputs = inputKeys.filter(key => {
      const value = inputs[key]
      return value === null || value === undefined || (typeof value === 'object' && value.value === null)
    })
    if (nullInputs.length > 0) {
      result.warnings.push(`⚠️ ${nullInputs.length} inputs con valor null: ${nullInputs.join(', ')}`)
    }
  }

  return result
}

function validateRegimesByCurrency(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '3. Regímenes Macro por Moneda',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  const regimes = data.regimes
  if (!regimes || Object.keys(regimes).length === 0) {
    result.warnings.push('⚠️ Regímenes por moneda no disponibles')
    return result
  }

  const currencies = Object.keys(regimes)
  result.details = { currencies }

  // Check for cloned regimes (same type and drivers)
  const regimeTypes: Record<string, string> = {}
  const regimeDrivers: Record<string, string[]> = {}
  
  for (const [currency, regime] of Object.entries(regimes)) {
    const type = regime.type || regime.regime
    regimeTypes[currency] = type
    
    const drivers = regime.drivers || {}
    const driverKeys = Object.keys(drivers).sort()
    regimeDrivers[currency] = driverKeys
    
    // Check drivers have dates
    for (const [driverKey, driver] of Object.entries(drivers)) {
      const driverDate = driver.date || driver.lastDate
      if (!driverDate) {
        result.warnings.push(`⚠️ ${currency}: Driver "${driverKey}" sin fecha`)
      } else {
        const date = new Date(driverDate)
        const now = new Date()
        const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        if (daysAgo > 90) {
          result.warnings.push(`⚠️ ${currency}: Driver "${driverKey}" fecha muy antigua (${Math.round(daysAgo)} días)`)
        }
      }
    }
  }

  // Check for duplicates
  const typeCounts: Record<string, string[]> = {}
  for (const [currency, type] of Object.entries(regimeTypes)) {
    if (!typeCounts[type]) typeCounts[type] = []
    typeCounts[type].push(currency)
  }

  for (const [type, currencies] of Object.entries(typeCounts)) {
    if (currencies.length > 1) {
      result.warnings.push(`⚠️ Mismo régimen "${type}" en múltiples monedas: ${currencies.join(', ')}`)
    }
  }

  // Check for identical drivers
  const driverStrings = Object.entries(regimeDrivers).map(([c, d]) => [c, d.join(',')])
  for (let i = 0; i < driverStrings.length; i++) {
    for (let j = i + 1; j < driverStrings.length; j++) {
      if (driverStrings[i][1] === driverStrings[j][1]) {
        result.passed = false
        result.errors.push(`❌ ${driverStrings[i][0]} y ${driverStrings[j][0]} tienen los mismos drivers (posible clonado)`)
      }
    }
  }

  result.details = { ...result.details, regimeTypes, driverCounts: regimeDrivers }

  return result
}

function validateScenarios(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '4. Escenarios Institucionales',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  const scenarios = data.scenarios
  if (!scenarios || Object.keys(scenarios).length === 0) {
    result.warnings.push('⚠️ Escenarios no disponibles')
    return result
  }

  const scenarioKeys = Object.keys(scenarios)
  result.details = { scenarios: scenarioKeys }

  // Check probabilities sum to 100%
  let sum = 0
  const probabilities: Record<string, number> = {}
  
  for (const [key, scenario] of Object.entries(scenarios)) {
    const prob = typeof scenario === 'number' ? scenario : scenario.probability
    if (prob === undefined || prob === null) {
      result.errors.push(`❌ Escenario "${key}" sin probabilidad`)
      continue
    }
    probabilities[key] = prob
    sum += prob
  }

  result.details = { ...result.details, probabilities, sum }

  if (Math.abs(sum - 1.0) > 0.01) {
    result.warnings.push(`⚠️ Probabilidades suman ${(sum * 100).toFixed(1)}% (debería ser 100%)`)
  }

  // Check for fixed probabilities (all equal)
  const values = Object.values(probabilities)
  if (values.length > 1) {
    const allEqual = values.every(v => Math.abs(v - values[0]) < 0.01)
    if (allEqual) {
      result.passed = false
      result.errors.push('❌ Todas las probabilidades son iguales (posible placeholder)')
    }
  }

  // Check timestamps
  for (const [key, scenario] of Object.entries(scenarios)) {
    const updatedAt = typeof scenario === 'object' ? scenario.updatedAt : undefined
    if (!updatedAt) {
      result.warnings.push(`⚠️ Escenario "${key}" sin timestamp`)
    }
  }

  return result
}

function validateIndicators(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '5. Indicadores Macro',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  const indicators = data.indicators || []
  if (indicators.length === 0) {
    result.passed = false
    result.errors.push('❌ No hay indicadores disponibles')
    return result
  }

  result.details = { totalIndicators: indicators.length }

  let nanCount = 0
  let infinityCount = 0
  let futureDateCount = 0
  let nullValueCount = 0
  let missingUnitCount = 0
  const now = new Date()

  for (const indicator of indicators) {
    const value = indicator.value
    
    // Check for NaN/Infinity
    if (typeof value === 'number') {
      if (isNaN(value)) {
        nanCount++
        result.errors.push(`❌ Indicador "${indicator.key || indicator.name}": valor NaN`)
      } else if (!isFinite(value)) {
        infinityCount++
        result.errors.push(`❌ Indicador "${indicator.key || indicator.name}": valor Infinity`)
      } else if (Math.abs(value) > 1000 && indicator.unit === '%') {
        result.warnings.push(`⚠️ Indicador "${indicator.key || indicator.name}": valor absurdo (${value}%)`)
      }
    } else if (value === null || value === undefined) {
      nullValueCount++
    }

    // Check date
    const date = indicator.date || indicator.lastDate
    if (date) {
      const dateObj = new Date(date)
      if (dateObj > now) {
        futureDateCount++
        result.errors.push(`❌ Indicador "${indicator.key || indicator.name}": fecha futura (${date})`)
      }
    }

    // Check unit
    if (!indicator.unit && value !== null) {
      missingUnitCount++
      result.warnings.push(`⚠️ Indicador "${indicator.key || indicator.name}": sin unidad`)
    }
  }

  if (nanCount > 0 || infinityCount > 0 || futureDateCount > 0) {
    result.passed = false
  }

  result.details = {
    ...result.details,
    nanCount,
    infinityCount,
    futureDateCount,
    nullValueCount,
    missingUnitCount,
  }

  return result
}

function validateTacticalPairs(data: DashboardResponse['data']): ValidationResult {
  const result: ValidationResult = {
    section: '6. Pares Tácticos',
    passed: true,
    warnings: [],
    errors: [],
  }

  if (!data) {
    result.passed = false
    result.errors.push('No data in response')
    return result
  }

  const pairs = data.tacticalPairs || data.pairs || []
  if (pairs.length === 0) {
    result.warnings.push('⚠️ No hay pares tácticos disponibles')
    return result
  }

  result.details = { totalPairs: pairs.length }

  // Check bias distribution
  const biasCounts: Record<string, number> = {}
  let missingDriversCount = 0
  let missingBiasCount = 0

  for (const pair of pairs) {
    const bias = pair.bias
    if (!bias) {
      missingBiasCount++
      result.warnings.push(`⚠️ Par "${pair.symbol}": sin sesgo`)
    } else {
      biasCounts[bias] = (biasCounts[bias] || 0) + 1
    }

    // Check drivers
    const drivers = pair.drivers || []
    if (drivers.length === 0) {
      missingDriversCount++
      result.warnings.push(`⚠️ Par "${pair.symbol}": sin drivers`)
    } else if (drivers.length < 2) {
      result.warnings.push(`⚠️ Par "${pair.symbol}": solo ${drivers.length} driver(s) (recomendado: 2-3)`)
    }
  }

  result.details = { ...result.details, biasCounts, missingDriversCount, missingBiasCount }

  // Check for all same bias
  const uniqueBiases = Object.keys(biasCounts)
  if (uniqueBiases.length === 1 && pairs.length > 1) {
    result.passed = false
    result.errors.push(`❌ Todos los pares tienen el mismo sesgo "${uniqueBiases[0]}" (posible bug)`)
  }

  // Check for all neutral
  if (biasCounts.neutral === pairs.length && pairs.length > 1) {
    result.passed = false
    result.errors.push('❌ Todos los pares son neutral (posible desconexión de inputs)')
  }

  return result
}

function printReport(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 REPORTE DE VALIDACIÓN QA - DASHBOARD MACRO TRADING')
  console.log('='.repeat(80))
  console.log(`URL: ${DASHBOARD_URL}`)
  console.log(`Fecha: ${new Date().toISOString()}`)
  console.log('='.repeat(80) + '\n')

  let totalPassed = 0
  let totalWarnings = 0
  let totalErrors = 0

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.section}`)
    
    if (result.errors.length > 0) {
      totalErrors += result.errors.length
      result.errors.forEach(err => console.log(`   ${err}`))
    }
    
    if (result.warnings.length > 0) {
      totalWarnings += result.warnings.length
      result.warnings.forEach(warn => console.log(`   ${warn}`))
    }
    
    if (result.details) {
      console.log(`   📋 Detalles:`, JSON.stringify(result.details, null, 2).split('\n').slice(0, 5).join('\n'))
    }
    
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('   ✅ Sin problemas detectados')
      totalPassed++
    }
    
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('📈 RESUMEN')
  console.log('='.repeat(80))
  console.log(`✅ Secciones OK: ${totalPassed}/${results.length}`)
  console.log(`⚠️  Advertencias: ${totalWarnings}`)
  console.log(`❌ Errores: ${totalErrors}`)
  console.log('='.repeat(80) + '\n')

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('🎉 ¡Todas las validaciones pasaron!')
    process.exit(0)
  } else if (totalErrors === 0) {
    console.log('⚠️  Hay advertencias pero no errores críticos')
    process.exit(0)
  } else {
    console.log('❌ Se encontraron errores críticos que requieren atención')
    process.exit(1)
  }
}

async function main() {
  console.log('🔍 Iniciando validación QA del dashboard...')
  console.log(`📍 URL: ${DASHBOARD_URL}\n`)

  try {
    const dashboard = await fetchDashboard()
    
    if (dashboard.error) {
      console.error('❌ Error en respuesta del dashboard:', dashboard.error)
      process.exit(1)
    }

    const data = dashboard.data
    if (!data) {
      console.error('❌ No hay datos en la respuesta')
      process.exit(1)
    }

    const results: ValidationResult[] = [
      validateCoverage(data),
      validateRegime(data),
      validateRegimesByCurrency(data),
      validateScenarios(data),
      validateIndicators(data),
      validateTacticalPairs(data),
    ]

    printReport(results)
  } catch (error) {
    console.error('❌ Error durante la validación:', error)
    process.exit(1)
  }
}

main()
