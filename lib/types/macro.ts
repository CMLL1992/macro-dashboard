/**
 * Common types and contracts for macro data sources
 */

export type Frequency = 'A' | 'Q' | 'M' | 'W' | 'D'

export type Source = 'FRED' | 'WORLD_BANK' | 'IMF' | 'ECB_SDW' | 'TRADING_ECONOMICS' | 'ALPHA_VANTAGE' | 'OECD' | 'DBNOMICS' | 'MANUAL'

export interface DataPoint {
  date: string
  value: number | null
}

export interface MacroSeries {
  id: string // SOURCE:nativeId[:country]
  source: Source
  indicator: string
  nativeId: string
  name: string
  frequency: Frequency
  unit?: string
  country?: string
  data: DataPoint[]
  lastUpdated?: string
  meta?: Record<string, unknown>
}
