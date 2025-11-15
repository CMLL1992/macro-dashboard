/**
 * Panel interno de verificación de datos
 * 
 * Este panel permite verificar que:
 * 1. Todos los indicadores macro tienen datos actualizados de sus fuentes oficiales
 * 2. Las correlaciones están calculadas correctamente para todos los símbolos activos
 * 3. Los datos no tienen valores fuera de rango o inconsistentes
 * 
 * Accesible en: /admin/data-health
 */

import { getDB } from '@/lib/db/schema'
import { getAllLatestFromDB, KEY_TO_SERIES_ID } from '@/lib/db/read-macro'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { getIndicatorSource, INDICATOR_SOURCES } from '@/lib/sources'
import { getActiveSymbols } from '@/lib/correlations/fetch'
import { isStaleByFrequency, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import { norm } from '@/lib/symbols'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Sanity check ranges (valores razonables para cada indicador)
const SANITY_RANGES: Record<string, { min: number; max: number }> = {
  CPIAUCSL: { min: -5, max: 20 }, // CPI YoY: -5% a 20%
  CPILFESL: { min: -2, max: 15 }, // Core CPI YoY: -2% a 15%
  PCEPI: { min: -5, max: 20 }, // PCE YoY: -5% a 20%
  PCEPILFE: { min: -2, max: 15 }, // Core PCE YoY: -2% a 15%
  PPIACO: { min: -10, max: 30 }, // PPI YoY: -10% a 30%
  GDPC1: { min: -10, max: 15 }, // GDP QoQ/YoY: -10% a 15%
  INDPRO: { min: -20, max: 20 }, // Industrial Production YoY: -20% a 20%
  RSXFS: { min: -30, max: 50 }, // Retail Sales YoY: -30% a 50%
  PAYEMS: { min: -1000, max: 1000 }, // NFP Delta: -1000k a 1000k
  UNRATE: { min: 0, max: 20 }, // Unemployment Rate: 0% a 20%
  ICSA: { min: 0, max: 1000000 }, // Initial Claims: 0 a 1M
  T10Y2Y: { min: -5, max: 5 }, // 10Y-2Y Spread: -5% a 5%
  FEDFUNDS: { min: 0, max: 20 }, // Fed Funds Rate: 0% a 20%
  VIX: { min: 0, max: 100 }, // VIX: 0 a 100
}

type IndicatorHealth = {
  key: string
  seriesId: string
  label: string
  source: string
  sourceUrl: string | null
  frequency: string
  value: number | null
  date: string | null
  lastUpdated: string | null
  status: 'OK' | 'STALE' | 'MISSING' | 'OUT_OF_RANGE' | 'INVALID'
  warnings: string[]
}

type CorrelationHealth = {
  symbol: string
  normalizedSymbol: string
  corr12m: number | null
  corr3m: number | null
  n_obs12m: number
  n_obs3m: number
  asof12m: string | null
  asof3m: string | null
  status: 'OK' | 'MISSING' | 'INSUFFICIENT_DATA' | 'INVALID'
  warnings: string[]
}

function checkIndicatorHealth(): IndicatorHealth[] {
  const db = getDB()
  const indicators = getAllLatestFromDB()
  const results: IndicatorHealth[] = []

  for (const indicator of indicators) {
    const seriesId = KEY_TO_SERIES_ID[indicator.key] || indicator.key
    const sourceInfo = getIndicatorSource(seriesId)
    const warnings: string[] = []

    // Get last updated timestamp from macro_series table
    const seriesMeta = db
      .prepare('SELECT last_updated FROM macro_series WHERE series_id = ?')
      .get(seriesId) as { last_updated: string | null } | undefined

    const lastUpdated = seriesMeta?.last_updated || null

    // Check if value is missing
    if (indicator.value === null || indicator.value === undefined) {
      results.push({
        key: indicator.key,
        seriesId,
        label: indicator.label,
        source: sourceInfo?.source || 'Unknown',
        sourceUrl: sourceInfo?.sourceUrl || null,
        frequency: sourceInfo?.frequency || 'Unknown',
        value: null,
        date: indicator.date || null,
        lastUpdated,
        status: 'MISSING',
        warnings: ['No hay valor disponible en la base de datos'],
      })
      continue
    }

    // Check if value is NaN or invalid
    if (!Number.isFinite(indicator.value)) {
      results.push({
        key: indicator.key,
        seriesId,
        label: indicator.label,
        source: sourceInfo?.source || 'Unknown',
        sourceUrl: sourceInfo?.sourceUrl || null,
        frequency: sourceInfo?.frequency || 'Unknown',
        value: indicator.value,
        date: indicator.date || null,
        lastUpdated,
        status: 'INVALID',
        warnings: [`Valor no numérico: ${indicator.value}`],
      })
      continue
    }

    // Check if value is out of range
    const range = SANITY_RANGES[seriesId]
    if (range) {
      if (indicator.value < range.min || indicator.value > range.max) {
        warnings.push(
          `Valor fuera de rango esperado: ${indicator.value.toFixed(2)} (esperado: ${range.min} a ${range.max})`
        )
      }
    }

    // Check if data is stale
    let status: IndicatorHealth['status'] = 'OK'
    if (indicator.date) {
      const freshness = isStaleByFrequency(indicator.date, indicator.key)
      if (freshness.isStale) {
        status = 'STALE'
        const sla = SLA_BY_FREQUENCY[freshness.frequency]
        const slaLabel = sla.useBusinessDays ? `${sla.maxDays} días hábiles` : `${sla.maxDays} días naturales`
        warnings.push(
          `Dato desactualizado: último dato ${indicator.date} (SLA: ${slaLabel})`
        )
      }
    } else {
      status = 'MISSING'
      warnings.push('No hay fecha disponible para el dato')
    }

    // Check if out of range
    if (warnings.some(w => w.includes('fuera de rango'))) {
      status = 'OUT_OF_RANGE'
    }

    results.push({
      key: indicator.key,
      seriesId,
      label: indicator.label,
      source: sourceInfo?.source || 'Unknown',
      sourceUrl: sourceInfo?.sourceUrl || null,
      frequency: sourceInfo?.frequency || 'Unknown',
      value: indicator.value,
      date: indicator.date || null,
      lastUpdated,
      status,
      warnings,
    })
  }

  return results
}

async function checkCorrelationHealth(): Promise<CorrelationHealth[]> {
  const symbols = await getActiveSymbols()
  const results: CorrelationHealth[] = []

  for (const symbol of symbols) {
    const normalizedSymbol = norm(symbol)
    const corr = getCorrelationsForSymbol(normalizedSymbol, 'DXY')
    const warnings: string[] = []

    let status: CorrelationHealth['status'] = 'OK'

    // Check if correlations are missing
    if (corr.corr12m === null && corr.corr3m === null) {
      status = 'MISSING'
      warnings.push('No hay correlaciones calculadas (ni 12m ni 3m)')
    } else {
      // Check if correlations are invalid
      if (corr.corr12m !== null && (!Number.isFinite(corr.corr12m) || corr.corr12m < -1 || corr.corr12m > 1)) {
        warnings.push(`Correlación 12m inválida: ${corr.corr12m}`)
        status = 'INVALID'
      }
      if (corr.corr3m !== null && (!Number.isFinite(corr.corr3m) || corr.corr3m < -1 || corr.corr3m > 1)) {
        warnings.push(`Correlación 3m inválida: ${corr.corr3m}`)
        status = 'INVALID'
      }

      // Check if we have sufficient observations
      const MIN_OBS_12M = 150
      const MIN_OBS_3M = 40

      if (corr.corr12m !== null && corr.n_obs12m < MIN_OBS_12M) {
        warnings.push(
          `Correlación 12m tiene pocas observaciones: ${corr.n_obs12m} (mínimo recomendado: ${MIN_OBS_12M})`
        )
        if (status === 'OK') status = 'INSUFFICIENT_DATA'
      }

      if (corr.corr3m !== null && corr.n_obs3m < MIN_OBS_3M) {
        warnings.push(
          `Correlación 3m tiene pocas observaciones: ${corr.n_obs3m} (mínimo recomendado: ${MIN_OBS_3M})`
        )
        if (status === 'OK') status = 'INSUFFICIENT_DATA'
      }
    }

    results.push({
      symbol,
      normalizedSymbol,
      corr12m: corr.corr12m,
      corr3m: corr.corr3m,
      n_obs12m: corr.n_obs12m,
      n_obs3m: corr.n_obs3m,
      asof12m: corr.asof12m,
      asof3m: corr.asof3m,
      status,
      warnings,
    })
  }

  return results
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'OK':
      return 'text-green-700 bg-green-50 border-green-200'
    case 'STALE':
      return 'text-amber-700 bg-amber-50 border-amber-200'
    case 'MISSING':
      return 'text-red-700 bg-red-50 border-red-200'
    case 'OUT_OF_RANGE':
    case 'INVALID':
      return 'text-red-700 bg-red-50 border-red-200'
    case 'INSUFFICIENT_DATA':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

export default async function DataHealthPage() {
  const indicators = checkIndicatorHealth()
  const correlations = await checkCorrelationHealth()

  const indicatorStats = {
    total: indicators.length,
    ok: indicators.filter(i => i.status === 'OK').length,
    stale: indicators.filter(i => i.status === 'STALE').length,
    missing: indicators.filter(i => i.status === 'MISSING').length,
    outOfRange: indicators.filter(i => i.status === 'OUT_OF_RANGE').length,
    invalid: indicators.filter(i => i.status === 'INVALID').length,
  }

  const correlationStats = {
    total: correlations.length,
    ok: correlations.filter(c => c.status === 'OK').length,
    missing: correlations.filter(c => c.status === 'MISSING').length,
    insufficient: correlations.filter(c => c.status === 'INSUFFICIENT_DATA').length,
    invalid: correlations.filter(c => c.status === 'INVALID').length,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Panel de Verificación de Datos</h1>
        <p className="text-gray-600 mb-8">
          Verificación institucional de la integridad y actualización de los datos macroeconómicos y correlaciones.
        </p>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Indicadores Macro</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{indicatorStats.total}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>OK:</span>
                <span className="font-semibold">{indicatorStats.ok}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>STALE:</span>
                <span className="font-semibold">{indicatorStats.stale}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>MISSING:</span>
                <span className="font-semibold">{indicatorStats.missing}</span>
              </div>
              {indicatorStats.outOfRange > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>OUT_OF_RANGE:</span>
                  <span className="font-semibold">{indicatorStats.outOfRange}</span>
                </div>
              )}
              {indicatorStats.invalid > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>INVALID:</span>
                  <span className="font-semibold">{indicatorStats.invalid}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Correlaciones</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{correlationStats.total}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>OK:</span>
                <span className="font-semibold">{correlationStats.ok}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>MISSING:</span>
                <span className="font-semibold">{correlationStats.missing}</span>
              </div>
              <div className="flex justify-between text-yellow-700">
                <span>INSUFFICIENT_DATA:</span>
                <span className="font-semibold">{correlationStats.insufficient}</span>
              </div>
              {correlationStats.invalid > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>INVALID:</span>
                  <span className="font-semibold">{correlationStats.invalid}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indicators Table */}
        <div className="bg-white rounded-lg border mb-8">
          <h2 className="text-xl font-semibold p-4 border-b">Indicadores Macro</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Indicador</th>
                  <th className="px-4 py-2 text-left">Fuente</th>
                  <th className="px-4 py-2 text-left">ID Oficial</th>
                  <th className="px-4 py-2 text-left">Frecuencia</th>
                  <th className="px-4 py-2 text-left">Valor</th>
                  <th className="px-4 py-2 text-left">Fecha Dato</th>
                  <th className="px-4 py-2 text-left">Última Actualización</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind) => (
                  <tr key={ind.key} className="border-t">
                    <td className="px-4 py-2">
                      <div className="font-medium">{ind.label}</div>
                      {ind.warnings.length > 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          {ind.warnings.map((w, i) => (
                            <div key={i}>⚠ {w}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {ind.sourceUrl ? (
                        <a
                          href={ind.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {ind.source}
                        </a>
                      ) : (
                        ind.source
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{ind.seriesId}</td>
                    <td className="px-4 py-2">{ind.frequency}</td>
                    <td className="px-4 py-2">
                      {ind.value !== null ? (
                        <span className="font-mono">{ind.value.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{ind.date || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{ind.lastUpdated || '—'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                          ind.status
                        )}`}
                      >
                        {ind.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Correlations Table */}
        <div className="bg-white rounded-lg border">
          <h2 className="text-xl font-semibold p-4 border-b">Correlaciones</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Símbolo</th>
                  <th className="px-4 py-2 text-left">Símbolo Normalizado</th>
                  <th className="px-4 py-2 text-left">Corr. 12m</th>
                  <th className="px-4 py-2 text-left">N Obs 12m</th>
                  <th className="px-4 py-2 text-left">Corr. 3m</th>
                  <th className="px-4 py-2 text-left">N Obs 3m</th>
                  <th className="px-4 py-2 text-left">As of 12m</th>
                  <th className="px-4 py-2 text-left">As of 3m</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((corr) => (
                  <tr key={corr.symbol} className="border-t">
                    <td className="px-4 py-2 font-mono">{corr.symbol}</td>
                    <td className="px-4 py-2 font-mono text-xs">{corr.normalizedSymbol}</td>
                    <td className="px-4 py-2">
                      {corr.corr12m !== null ? (
                        <span className="font-mono">{corr.corr12m.toFixed(3)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{corr.n_obs12m}</td>
                    <td className="px-4 py-2">
                      {corr.corr3m !== null ? (
                        <span className="font-mono">{corr.corr3m.toFixed(3)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{corr.n_obs3m}</td>
                    <td className="px-4 py-2 font-mono text-xs">{corr.asof12m || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{corr.asof3m || '—'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                          corr.status
                        )}`}
                      >
                        {corr.status}
                      </span>
                      {corr.warnings.length > 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          {corr.warnings.map((w, i) => (
                            <div key={i}>⚠ {w}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

