/**
 * e-Stat API (Japan Statistics Bureau) ingestor
 * https://www.e-stat.go.jp/api/
 * Requires AppID (set in ESTAT_APP_ID environment variable)
 */

import type { Observation } from '@/lib/macro/prev-curr'

const ESTAT_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json'

/**
 * Mapeo de indicadores internos a estadísticas IDs de e-Stat
 * Nota: Estos IDs pueden necesitar ajuste según la estructura real de e-Stat
 */
const ESTAT_STATS_MAP: Record<string, { statsDataId: string; params: Record<string, string> }> = {
  'JP_CPI_YOY': {
    statsDataId: '0003109941', // Consumer Price Index (ejemplo - verificar ID real)
    params: {
      lang: 'E', // English
      statsDataId: '0003109941',
      metaGetFlg: 'N',
      cntGetFlg: 'N',
    },
  },
  'JP_GDP_QOQ': {
    statsDataId: '0003109942', // GDP (ejemplo - verificar ID real)
    params: {
      lang: 'E',
      statsDataId: '0003109942',
      metaGetFlg: 'N',
      cntGetFlg: 'N',
    },
  },
  'JP_UNEMPLOYMENT_RATE': {
    statsDataId: '0003109943', // Unemployment Rate (ejemplo - verificar ID real)
    params: {
      lang: 'E',
      statsDataId: '0003109943',
      metaGetFlg: 'N',
      cntGetFlg: 'N',
    },
  },
}

/**
 * Obtiene datos de un indicador JP desde e-Stat
 */
export async function fetchEstatIndicator(indicatorId: string, appId: string): Promise<Observation[]> {
  if (!appId) {
    throw new Error('ESTAT_APP_ID environment variable is required for e-Stat API')
  }
  
  const config = ESTAT_STATS_MAP[indicatorId]
  
  if (!config) {
    throw new Error(`No e-Stat mapping found for indicator: ${indicatorId}`)
  }
  
  // Construir URL con parámetros
  const params = new URLSearchParams({
    appId,
    ...config.params,
  })
  
  const url = `${ESTAT_BASE}/getStatsData?${params.toString()}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`e-Stat API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  
  // Parsear respuesta e-Stat (estructura puede variar)
  // e-Stat devuelve datos en formato JSON con estructura específica
  if (!data.GET_STATS_DATA || !data.GET_STATS_DATA.STATISTICAL_DATA) {
    throw new Error(`Invalid e-Stat response structure for ${indicatorId}`)
  }
  
  const statisticalData = data.GET_STATS_DATA.STATISTICAL_DATA
  const dataPoints = statisticalData.DATA_INF?.VALUE || []
  
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    throw new Error(`No data points returned from e-Stat for ${indicatorId}`)
  }
  
  // Convertir a formato estándar
  const observations: Observation[] = []
  
  for (const point of dataPoints) {
    const dateStr = point['@time'] || point.time
    const valueStr = point['@value'] || point.value
    
    if (!dateStr || !valueStr) {
      continue
    }
    
    const value = parseFloat(valueStr)
    if (!isFinite(value)) {
      continue
    }
    
    // Normalizar fecha (e-Stat puede usar varios formatos)
    let normalizedDate: string
    
    if (dateStr.match(/^\d{4}$/)) {
      // Año: "2023" -> "2023-12-31"
      normalizedDate = `${dateStr}-12-31`
    } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Mes: "2023-08" -> "2023-08-01"
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
  
  if (observations.length === 0) {
    throw new Error(`No valid observations parsed from e-Stat for ${indicatorId}`)
  }
  
  return observations
}
