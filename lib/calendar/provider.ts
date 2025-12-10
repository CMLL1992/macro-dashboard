/**
 * Interfaz del proveedor de calendario económico
 * Implementa esta interfaz para añadir nuevos proveedores sin modificar la lógica de negocio
 */

import { ProviderCalendarEvent, ProviderRelease } from './types'

export interface CalendarProvider {
  /**
   * Obtiene eventos del calendario económico en un rango de fechas
   */
  fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]>

  /**
   * Obtiene el release real de un evento específico
   * Retorna null si el dato aún no ha sido publicado
   */
  fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null>
}

