/**
 * Centralized helper for European indicators
 * Uses the same data source as /api/debug/european-indicators
 * Ensures consistency between debug endpoint and dashboard
 */

import { getAllLatestFromDBWithPrev, type LatestPointWithPrev } from '@/lib/db/read-macro'

export type EuropeanIndicatorRow = {
  key: string
  label: string
  value: number | null
  valuePrevious: number | null
  date: string | null
  datePrevious: string | null
  unit?: string | null
  isStale?: boolean
}

/**
 * Get European indicators for dashboard
 * Uses getAllLatestFromDBWithPrev() - the same function used by getMacroDiagnosis()
 * This ensures the dashboard shows exactly what the debug endpoint shows
 */
export async function getEuropeanIndicatorsForDashboard(): Promise<EuropeanIndicatorRow[]> {
  // Get all latest data (same as debug endpoint)
  const latest = await getAllLatestFromDBWithPrev()
  
  // Filter only European indicators
  const euData = latest.filter((item) => item.key.startsWith('eu_'))
  
  // Map to dashboard format
  return euData.map((item) => ({
    key: item.key,
    label: item.label ?? item.key,
    value: item.value ?? null,
    valuePrevious: item.value_previous ?? null,
    date: item.date ?? null,
    datePrevious: item.date_previous ?? null,
    unit: item.unit ?? null,
    isStale: item.isStale ?? false,
  }))
}

/**
 * Get all European indicator keys (for reference)
 */
export const EUROPEAN_INDICATOR_KEYS = [
  'eu_gdp_qoq',
  'eu_gdp_yoy',
  'eu_cpi_yoy',
  'eu_cpi_core_yoy',
  'eu_unemployment',
  'eu_pmi_manufacturing',
  'eu_pmi_services',
  'eu_pmi_composite',
  'eu_ecb_rate',
  'eu_retail_sales_yoy',
  'eu_industrial_production_yoy',
  'eu_consumer_confidence',
  'eu_zew_sentiment',
] as const
