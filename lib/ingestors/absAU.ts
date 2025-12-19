/**
 * ABS (Australian Bureau of Statistics) Data API ingestor
 * https://www.abs.gov.au/statistics
 * Uses SDMX 2.1 format
 */

import type { Observation } from '@/lib/macro/prev-curr'

const ABS_BASE = 'https://api.data.abs.gov.au'

/**
 * Mapeo de indicadores internos a códigos SDMX de ABS
 * Nota: Estos códigos pueden necesitar ajuste según la estructura real de ABS
 */
const ABS_SDMX_MAP: Record<string, { dataflow: string; key: string }> = {
  'AU_CPI_YOY': {
    dataflow: 'ABS,CPI,1.0',
    key: 'M.0.10.1.0.0', // CPI All groups, Australia, YoY
  },
  'AU_CORE_CPI_YOY': {
    dataflow: 'ABS,CPI,1.0',
    key: 'M.0.10.1.0.1', // CPI Trimmed mean, Australia, YoY
  },
  'AU_GDP_QOQ': {
    dataflow: 'ABS,GDP,1.0',
    key: 'Q.0.0.0.0.0', // GDP, Australia, QoQ
  },
  'AU_GDP_YOY': {
    dataflow: 'ABS,GDP,1.0',
    key: 'Q.0.0.0.0.1', // GDP, Australia, YoY
  },
  'AU_UNEMPLOYMENT_RATE': {
    dataflow: 'ABS,LFS,1.0',
    key: 'M.0.0.0.0.0', // Unemployment rate, Australia
  },
}

/**
 * Obtiene datos de un indicador AU desde ABS usando SDMX
 */
export async function fetchABSIndicator(indicatorId: string): Promise<Observation[]> {
  const config = ABS_SDMX_MAP[indicatorId]
  
  if (!config) {
    throw new Error(`No ABS mapping found for indicator: ${indicatorId}`)
  }
  
  // Construir URL SDMX
  // Formato: /data/{dataflow}/{key}?format=jsondata
  const keyEncoded = encodeURIComponent(config.key)
  const url = `${ABS_BASE}/data/${config.dataflow}/${keyEncoded}?format=jsondata&detail=full`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`ABS API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  
  // Parsear respuesta SDMX (estructura puede variar según implementación)
  // SDMX JSON tiene estructura específica con dataSets
  if (!data.dataSets || !Array.isArray(data.dataSets) || data.dataSets.length === 0) {
    throw new Error(`Invalid ABS SDMX response structure for ${indicatorId}`)
  }
  
  const dataSet = data.dataSets[0]
  const series = dataSet.series || {}
  const observations: Observation[] = []
  
  // SDMX estructura: series[seriesKey].observations[timeKey] = value
  for (const [seriesKey, seriesData] of Object.entries(series)) {
    const obsData = (seriesData as any).observations || {}
    
    for (const [timeKey, value] of Object.entries(obsData)) {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value))
      
      if (!isFinite(numValue)) {
        continue
      }
      
      // Obtener fecha del timeKey (puede ser índice o código de tiempo)
      // Necesitamos mapear timeKey a fecha usando la estructura de tiempo de SDMX
      // Por simplicidad, asumimos que timeKey es un índice que mapea a fechas
      // En implementación real, necesitarías parsear la estructura de tiempo de SDMX
      let normalizedDate: string
      
      // Intentar parsear timeKey como fecha o índice
      if (typeof timeKey === 'string' && timeKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalizedDate = timeKey
      } else if (typeof timeKey === 'string' && timeKey.match(/^\d{4}-\d{2}$/)) {
        normalizedDate = `${timeKey}-01`
      } else {
        // Si timeKey es un índice, necesitaríamos la estructura de tiempo de SDMX
        // Por ahora, saltamos este punto
        continue
      }
      
      observations.push({
        date: normalizedDate,
        value: numValue,
      })
    }
  }
  
  // Ordenar por fecha ascendente
  observations.sort((a, b) => a.date.localeCompare(b.date))
  
  if (observations.length === 0) {
    throw new Error(`No valid observations parsed from ABS for ${indicatorId}`)
  }
  
  return observations
}
