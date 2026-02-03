/**
 * Funciones para procesar indicadores según horizonte temporal (Diario/Semanal/Mensual)
 * Cada tab aplica una "lente" diferente sobre los mismos datos
 */

import type { IndicatorRow } from './dashboard-data'
import { safeArray, isFiniteNumber } from '@/lib/utils/guards'

export type TimeHorizon = 'daily' | 'weekly' | 'monthly'

export interface ProcessedIndicator extends IndicatorRow {
  change?: number | null // Δ vs anterior (para Diario)
  surprise?: number | null // Sorpresa vs consenso (si existe)
  weeklyMomentum?: number | null // Cambio últimos 5 días hábiles o 4 lecturas
  monthlyTrend?: 'acelerando' | 'desacelerando' | 'estable' // Basado en 3 últimas lecturas
  hasNewPublication?: boolean // Si hay nueva publicación en la semana
  confidence?: 'Alta' | 'Media' | 'Baja' // Confianza basada en consistencia
}

/**
 * Determina la frecuencia de un indicador
 */
function getIndicatorFrequency(key: string): 'daily' | 'weekly' | 'monthly' | 'quarterly' {
  const keyUpper = key.toUpperCase()
  
  // Diarios/financieros
  if (keyUpper.includes('T10Y') || keyUpper.includes('FEDFUNDS') || keyUpper.includes('VIX')) {
    return 'daily'
  }
  
  // Semanales
  if (keyUpper.includes('CLAIMS') || keyUpper.includes('ICSA')) {
    return 'weekly'
  }
  
  // Mensuales (la mayoría)
  if (keyUpper.includes('CPI') || keyUpper.includes('PCE') || keyUpper.includes('PPI') ||
      keyUpper.includes('PAYEMS') || keyUpper.includes('NFP') || keyUpper.includes('UNRATE') ||
      keyUpper.includes('PMI') || keyUpper.includes('RETAIL') || keyUpper.includes('INDPRO')) {
    return 'monthly'
  }
  
  // Trimestrales
  if (keyUpper.includes('GDP')) {
    return 'quarterly'
  }
  
  return 'monthly' // Default
}

/**
 * Procesa indicadores para vista DIARIA
 * Enfoque: cambio reciente y sorpresa
 */
export function processIndicatorsDaily(indicators: IndicatorRow[]): ProcessedIndicator[] {
  // FIX: Validar array antes de map
  const safeIndicators = safeArray<IndicatorRow>(indicators)
  return safeIndicators.map((ind) => {
    const change = ind.value !== null && ind.previous !== null 
      ? ind.value - ind.previous 
      : null
    
    // Sorpresa: por ahora null (requeriría consenso, que no tenemos en BD)
    // TODO: Integrar con tabla de eventos económicos si existe
    const surprise = null
    
    return {
      ...ind,
      change,
      surprise,
    }
  })
}

/**
 * Procesa indicadores para vista SEMANAL
 * Enfoque: confirmación / momentum
 */
export function processIndicatorsWeekly(indicators: IndicatorRow[]): ProcessedIndicator[] {
  // FIX: Validar array antes de map
  const safeIndicators = safeArray<IndicatorRow>(indicators)
  return safeIndicators.map((ind) => {
    const frequency = getIndicatorFrequency(ind.key)
    let weeklyMomentum: number | null = null
    let hasNewPublication = false
    
    if (frequency === 'daily' || frequency === 'weekly') {
      // Para diarios/semanales: cambio últimos 5 días hábiles o 4 lecturas
      // Por ahora usamos change vs previous como aproximación
      if (ind.value !== null && ind.previous !== null) {
        weeklyMomentum = ind.value - ind.previous
      }
      hasNewPublication = true // Asumimos que hay nueva publicación
    } else if (frequency === 'monthly') {
      // Para mensuales: "semana" = no cambia, arrastra último dato
      weeklyMomentum = null
      hasNewPublication = false
      // Etiquetar como "sin nueva publicación" se hace en el componente
    } else {
      // Trimestrales: no cambian en semana
      weeklyMomentum = null
      hasNewPublication = false
    }
    
    return {
      ...ind,
      weeklyMomentum,
      hasNewPublication,
    }
  })
}

/**
 * Procesa indicadores para vista MENSUAL
 * Enfoque: régimen dominante
 * Regla: usar 3 últimas lecturas para clasificar tendencia
 */
export function processIndicatorsMonthly(indicators: IndicatorRow[]): ProcessedIndicator[] {
  return indicators.map((ind) => {
    // Por ahora, usamos la tendencia existente como aproximación
    // TODO: Obtener 3 últimas lecturas desde BD para cálculo más preciso
    let monthlyTrend: 'acelerando' | 'desacelerando' | 'estable' = 'estable'
    
    if (ind.trend === 'Mejora') {
      monthlyTrend = 'acelerando'
    } else if (ind.trend === 'Empeora') {
      monthlyTrend = 'desacelerando'
    }
    
    // Confianza basada en consistencia (2 de 3 en misma dirección)
    // Por ahora usamos una aproximación basada en el peso y la tendencia
    let confidence: 'Alta' | 'Media' | 'Baja' = 'Media'
    const weight = ind.weight || 0
    if (weight >= 0.08 && monthlyTrend !== 'estable') {
      confidence = 'Alta'
    } else if (weight < 0.04 || monthlyTrend === 'estable') {
      confidence = 'Baja'
    }
    
    return {
      ...ind,
      monthlyTrend,
      confidence,
    }
  })
}

/**
 * Procesa indicadores según el horizonte temporal activo
 */
export function processIndicatorsByHorizon(
  indicators: IndicatorRow[],
  horizon: TimeHorizon
): ProcessedIndicator[] {
  switch (horizon) {
    case 'daily':
      return processIndicatorsDaily(indicators)
    case 'weekly':
      return processIndicatorsWeekly(indicators)
    case 'monthly':
      return processIndicatorsMonthly(indicators)
    default:
      return indicators.map(ind => ({ ...ind }))
  }
}

/**
 * Calcula drivers principales (top 3) según el horizonte temporal
 */
export function getTopDrivers(
  indicators: ProcessedIndicator[],
  horizon: TimeHorizon
): Array<{ key: string; label: string; reason: string }> {
  // FIX: Validar array antes de iterar
  const safeIndicators = safeArray<ProcessedIndicator>(indicators)
  const drivers: Array<{ key: string; label: string; reason: string; score: number }> = []
  
  for (const ind of safeIndicators) {
    if (ind.value === null) continue
    
    let score = 0
    let reason = ''
    
    if (horizon === 'daily') {
      // Diario: priorizar cambios grandes y sorpresas
      const changeAbs = isFiniteNumber(ind.change) ? Math.abs(ind.change) : 0
      const weight = isFiniteNumber(ind.weight) ? ind.weight : 0
      score = changeAbs * weight
      if (ind.change && Math.abs(ind.change) > 0.5) {
        reason = `Cambio de ${ind.change > 0 ? '+' : ''}${ind.change.toFixed(2)}${ind.unit || ''}`
      }
    } else if (horizon === 'weekly') {
      // Semanal: priorizar momentum consistente
      const momentumAbs = ind.weeklyMomentum ? Math.abs(ind.weeklyMomentum) : 0
      score = momentumAbs * (ind.weight || 0)
      if (ind.weeklyMomentum && Math.abs(ind.weeklyMomentum) > 0.3) {
        reason = `Momentum semanal: ${ind.weeklyMomentum > 0 ? '+' : ''}${ind.weeklyMomentum.toFixed(2)}${ind.unit || ''}`
      }
    } else {
      // Mensual: priorizar tendencias claras con alta importancia
      // Calcular importancia desde weight (no existe importance en ProcessedIndicator)
      const weight = ind.weight || 0
      const importance = weight >= 0.08 ? 'Alta' : weight >= 0.04 ? 'Media' : 'Baja'
      const importanceScore = importance === 'Alta' ? 3 : importance === 'Media' ? 2 : 1
      const trendScore = ind.monthlyTrend === 'acelerando' || ind.monthlyTrend === 'desacelerando' ? 2 : 1
      score = importanceScore * trendScore * (ind.weight || 0)
      if (ind.monthlyTrend !== 'estable') {
        reason = `Tendencia ${ind.monthlyTrend} con ${importance} importancia`
      }
    }
    
    if (score > 0) {
      drivers.push({ key: ind.key, label: ind.label, reason, score })
    }
  }
  
  // Ordenar por score y tomar top 3
  return drivers
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ key, label, reason }) => ({ key, label, reason }))
}

/**
 * Calcula confianza del régimen según el horizonte temporal
 */
export function calculateRegimeConfidence(
  indicators: ProcessedIndicator[],
  horizon: TimeHorizon
): { level: 'Alta' | 'Media' | 'Baja'; explanation: string } {
  if (horizon === 'daily') {
    // Diario: confianza alta si hay cambios claros, baja si todo está estable
    const hasChanges = indicators.some(ind => ind.change && Math.abs(ind.change) > 0.1)
    const hasData = indicators.filter(ind => ind.value !== null).length / indicators.length
    
    if (hasData >= 0.9 && hasChanges) {
      return { level: 'Alta', explanation: 'Múltiples indicadores con cambios recientes' }
    } else if (hasData >= 0.7) {
      return { level: 'Media', explanation: 'Datos suficientes pero cambios limitados' }
    } else {
      return { level: 'Baja', explanation: 'Datos insuficientes o sin cambios significativos' }
    }
  } else if (horizon === 'weekly') {
    // Semanal: confianza basada en consistencia del momentum
    const withMomentum = indicators.filter(ind => ind.weeklyMomentum !== null).length
    const consistentMomentum = indicators.filter(ind => {
      if (ind.weeklyMomentum === null) return false
      const sameDirection = indicators.filter(i =>
        i.weeklyMomentum !== null && i.weeklyMomentum !== undefined &&
        ind.weeklyMomentum !== null && ind.weeklyMomentum !== undefined &&
        (i.weeklyMomentum > 0) === (ind.weeklyMomentum > 0)
      ).length
      return sameDirection >= indicators.length * 0.6
    }).length
    
    if (withMomentum >= indicators.length * 0.8 && consistentMomentum > 0) {
      return { level: 'Alta', explanation: 'Momentum semanal consistente en múltiples indicadores' }
    } else if (withMomentum >= indicators.length * 0.6) {
      return { level: 'Media', explanation: 'Momentum presente pero con señales mixtas' }
    } else {
      return { level: 'Baja', explanation: 'Momentum limitado o señales contradictorias' }
    }
  } else {
    // Mensual: confianza basada en consistencia de tendencias (2 de 3 en misma dirección)
    const withTrend = indicators.filter(ind => ind.monthlyTrend !== 'estable').length
    const accelerating = indicators.filter(ind => ind.monthlyTrend === 'acelerando').length
    const decelerating = indicators.filter(ind => ind.monthlyTrend === 'desacelerando').length
    const dominantDirection = Math.max(accelerating, decelerating)
    const consistency = dominantDirection / Math.max(withTrend, 1)
    
    if (consistency >= 0.7 && withTrend >= indicators.length * 0.5) {
      return { level: 'Alta', explanation: 'Tendencias consistentes en múltiples pilares' }
    } else if (consistency >= 0.5) {
      return { level: 'Media', explanation: 'Tendencias presentes pero con señales mixtas' }
    } else {
      return { level: 'Baja', explanation: 'Señales cruzadas o cambios fuertes recientes' }
    }
  }
}
