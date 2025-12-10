/**
 * Utility functions for formatting indicator dates
 * Formats dates according to the period type (monthly, quarterly, weekly, daily)
 */

import { getIndicatorConfig } from '@/config/macro-indicators'
import type { PeriodType } from '@/config/macro-indicators'

/**
 * Format indicator date - ahora muestra fecha de publicación (realtime_start)
 * Formato: "05 dic 2025" (fecha completa de publicación, no periodo del dato)
 */
export function formatIndicatorDate(dateStr: string | null | undefined, indicatorKey?: string): string {
  if (!dateStr) return '—'
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    
    // Siempre mostrar fecha completa de publicación (no periodo)
    // Formato: "05 dic 2025"
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  } catch {
    return '—'
  }
}

/**
 * Format indicator date for tooltip (full date)
 * @param dateStr Fecha de publicación (realtime_start)
 * @param observationPeriod Periodo del dato (observation_date) - opcional
 */
export function formatIndicatorDateTooltip(
  dateStr: string | null | undefined, 
  observationPeriod?: string | null
): string {
  if (!dateStr) return ''
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    
    const releaseDate = date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    
    // Si hay observation_period y es diferente de la fecha de publicación, mostrarlo
    if (observationPeriod && observationPeriod !== dateStr) {
      try {
        const periodDate = new Date(observationPeriod)
        if (!isNaN(periodDate.getTime())) {
          const monthNamesES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
          const year = periodDate.getUTCFullYear()
          const month = periodDate.getUTCMonth()
          const day = periodDate.getUTCDate()
          
          // Formatear periodo según el tipo
          let periodStr = ''
          if (day === 1 && month % 3 === 0) {
            // Probablemente trimestral
            const quarter = Math.floor(month / 3) + 1
            periodStr = `Q${quarter} ${year}`
          } else {
            // Mensual o diario
            periodStr = `${monthNamesES[month]} ${year}`
          }
          
          return `Dato correspondiente a ${periodStr} — publicado el ${releaseDate}`
        }
      } catch {
        // Si falla parsear el periodo, solo mostrar fecha de publicación
      }
    }
    
    return releaseDate
  } catch {
    return ''
  }
}

