/**
 * ONS (Office for National Statistics) UK Beta API ingestor
 * https://developer.ons.gov.uk/
 * No API key required
 */

import type { Observation } from '@/lib/macro/prev-curr'

const ONS_BASE = 'https://api.beta.ons.gov.uk/v1'

/**
 * Mapeo de indicadores internos a datasets ONS
 */
const ONS_DATASET_MAP: Record<string, { datasetId: string; edition: string; dimensions: Record<string, string> }> = {
  'UK_CPI_YOY': {
    datasetId: 'cpih01',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001', // UK
      aggregate: 'cpih1dim1A0', // All items CPI
    },
  },
  'UK_CORE_CPI_YOY': {
    datasetId: 'cpih01',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001',
      aggregate: 'cpih1dim1G00', // Core CPI (excl. energy, food, alcohol & tobacco)
    },
  },
  'UK_GDP_QOQ': {
    datasetId: 'gdpqna',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001',
      aggregate: 'ABMI', // GDP Quarter-on-Quarter
    },
  },
  'UK_GDP_YOY': {
    datasetId: 'gdpqna',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001',
      aggregate: 'YBHA', // GDP Year-on-Year
    },
  },
  'UK_UNEMPLOYMENT_RATE': {
    datasetId: 'lms',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001',
      aggregate: 'YCEU', // Unemployment rate
    },
  },
  'UK_RETAIL_SALES_YOY': {
    datasetId: 'retail-sales',
    edition: 'time-series',
    dimensions: {
      geography: 'K02000001',
      aggregate: 'YEAR', // Year-on-year growth
    },
  },
}

/**
 * Obtiene la última versión de un dataset
 */
async function getLatestVersion(datasetId: string, edition: string): Promise<string> {
  const url = `${ONS_BASE}/datasets/${datasetId}/editions/${edition}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`ONS API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  // La última versión está en data.items[0].version
  return data.items?.[0]?.version || '1'
}

/**
 * Obtiene observaciones de un dataset ONS
 */
async function fetchONSObservations(
  datasetId: string,
  edition: string,
  version: string,
  dimensions: Record<string, string>
): Promise<Observation[]> {
  // Construir query string para dimensiones
  const dimensionParams = new URLSearchParams()
  Object.entries(dimensions).forEach(([key, value]) => {
    dimensionParams.append(key, value)
  })
  
  const url = `${ONS_BASE}/datasets/${datasetId}/editions/${edition}/versions/${version}/observations?${dimensionParams.toString()}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`ONS API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  
  if (!data.observations || !Array.isArray(data.observations)) {
    return []
  }
  
  // Convertir observaciones ONS a formato estándar
  const observations: Observation[] = []
  
  for (const obs of data.observations) {
    const dateStr = obs.observation
    const value = parseFloat(obs.value)
    
    if (!dateStr || !isFinite(value)) {
      continue
    }
    
    // ONS usa formato "YYYY-MM" o "YYYY QX" para fechas
    // Convertir a formato YYYY-MM-DD
    let normalizedDate: string
    
    if (dateStr.includes('Q')) {
      // Formato trimestral: "2023 Q1" -> "2023-03-31"
      const [year, quarter] = dateStr.split(' Q')
      const quarterNum = parseInt(quarter, 10)
      const month = quarterNum * 3 // Q1=3, Q2=6, Q3=9, Q4=12
      normalizedDate = `${year}-${String(month).padStart(2, '0')}-01`
    } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Formato mensual: "2023-08" -> "2023-08-01"
      normalizedDate = `${dateStr}-01`
    } else {
      // Intentar parsear como fecha completa
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        continue
      }
      normalizedDate = date.toISOString().split('T')[0]
    }
    
    observations.push({
      date: normalizedDate,
      value,
    })
  }
  
  // Ordenar por fecha ascendente
  observations.sort((a, b) => a.date.localeCompare(b.date))
  
  return observations
}

/**
 * Obtiene datos de un indicador UK desde ONS
 */
export async function fetchONSIndicator(indicatorId: string): Promise<Observation[]> {
  const config = ONS_DATASET_MAP[indicatorId]
  
  if (!config) {
    throw new Error(`No ONS mapping found for indicator: ${indicatorId}`)
  }
  
  // Obtener última versión del dataset
  const version = await getLatestVersion(config.datasetId, config.edition)
  
  // Obtener observaciones
  const observations = await fetchONSObservations(
    config.datasetId,
    config.edition,
    version,
    config.dimensions
  )
  
  if (observations.length === 0) {
    throw new Error(`No observations returned from ONS for ${indicatorId}`)
  }
  
  return observations
}
