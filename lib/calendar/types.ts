/**
 * Tipos genéricos para proveedores de calendario económico
 * Abstracción que permite cambiar de proveedor sin modificar la lógica de negocio
 */

export type ProviderCalendarEvent = {
  externalId: string
  country: string // "US", "EU", ...
  currency: string // "USD", "EUR", ...
  name: string // "CPI YoY", "Nonfarm Payrolls", ...
  category?: string // "Inflation", "Employment", ...
  importance: 'low' | 'medium' | 'high'
  scheduledTimeUTC: string // ISO en UTC

  previous?: number | null
  consensus?: number | null
  consensusRangeMin?: number | null
  consensusRangeMax?: number | null

  // Para mapear a tus series internas
  maybeSeriesId?: string
  maybeIndicatorKey?: string

  // Para sorpresa direccional
  directionality?: 'higher_is_positive' | 'lower_is_positive'
}

export type ProviderRelease = {
  externalEventId: string // debe coincidir con externalId del evento
  actual: number
  previous?: number | null
  consensus?: number | null
  releaseTimeUTC: string // ISO en UTC
}

