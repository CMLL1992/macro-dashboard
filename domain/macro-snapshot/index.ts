/**
 * Macro Snapshot - Public API
 * 
 * Exporta el contrato único y validado del estado macro para trading.
 */

export * from './schema'
export * from './parser'
export * from './adapters'

// Re-export main functions for convenience
export { parseMacroSnapshot, parseMacroSnapshotFromRaw } from './parser'
export { extractUpcomingDates } from './adapters/calendar'
// Narrativas eliminadas
// export { extractNarrative } from './adapters/narratives'
export { dashboardToSnapshot, dashboardToSnapshotFallback } from './adapters/dashboard'
export type { MacroSnapshot, ParseResult } from './schema'

