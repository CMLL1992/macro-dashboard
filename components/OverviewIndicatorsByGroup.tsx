'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/components/ui/utils'
import { safeArray, isFiniteNumber, safeDate } from '@/lib/utils/guards'
import { getIndicatorConfig } from '@/config/macro-indicators'
import { GROUP_LABEL, type OverviewGroup, getCurrencyFlag, getCurrencyName } from '@/lib/utils/overview-meta'

export interface OverviewIndicatorRow {
  key: string
  label: string
  currency: string
  group: OverviewGroup | string
  section: string
  value: number | null
  date: string | null
  valuePrevious?: number | null
  datePrevious?: string | null
  change?: number | null
  changePct?: number | null
  unit?: string
  trend?: 'acelera' | 'desacelera' | 'estable'
  importance?: 'Alta' | 'Media' | 'Baja'
  weeklyMomentum?: number | null
  hasNewPublication?: boolean
  monthlyTrend?: 'acelerando' | 'desacelerando' | 'estable'
}

interface OverviewIndicatorsByGroupProps {
  indicators: OverviewIndicatorRow[]
  groupsOrder: OverviewGroup[]
  currenciesOrder: string[]
  horizon?: 'daily' | 'weekly' | 'monthly'
}

export default function OverviewIndicatorsByGroup({
  indicators,
  groupsOrder,
  currenciesOrder,
  horizon = 'daily',
}: OverviewIndicatorsByGroupProps) {
  const safeIndicators = safeArray<OverviewIndicatorRow>(indicators)
  const currencyIndex = (c: string) => {
    const i = currenciesOrder.indexOf(c)
    return i >= 0 ? i : 999
  }

  const grouped = groupsOrder.reduce<Record<string, OverviewIndicatorRow[]>>((acc, group) => {
    const rows = safeIndicators.filter((r) => String(r.group) === group)
    rows.sort((a, b) => currencyIndex(a.currency) - currencyIndex(b.currency))
    if (rows.length) acc[group] = rows
    return acc
  }, {})

  const formatValue = (value: number | null, unit?: string, indicatorKey?: string) => {
    if (value === null) return 'N/A'
    if (!isFiniteNumber(value)) return '—'
    if (indicatorKey) {
      try {
        const config = getIndicatorConfig(indicatorKey)
        if (config) {
          const decimals = typeof config.decimals === 'number' && config.decimals >= 0 ? config.decimals : 0
          const rounded = Number(value.toFixed(decimals))
          switch (config.unit) {
            case 'percent':
              return `${rounded.toFixed(decimals)}%`
            case 'millions':
              return `${rounded.toFixed(decimals)}M`
            case 'thousands':
              return `${rounded.toFixed(decimals)}K`
            default:
              return rounded.toFixed(decimals)
          }
        }
      } catch {
        // ignore
      }
    }
    return value.toFixed(2)
  }

  const getTrendIcon = (trend?: string) => {
    if (trend === 'acelera') return '↑'
    if (trend === 'desacelera') return '↓'
    return '→'
  }
  const getTrendColor = (trend?: string) => {
    if (trend === 'acelera') return 'text-green-600 dark:text-green-400'
    if (trend === 'desacelera') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Macro Drivers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groupsOrder.map((group) => {
            const rows = grouped[group] ?? []
            if (rows.length === 0) return null
            const title = GROUP_LABEL[group] ?? group
            return (
              <div key={group} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {title}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Región</th>
                        <th className="text-left py-2 px-2">Indicador</th>
                        <th className="text-right py-2 px-2">Anterior</th>
                        <th className="text-right py-2 px-2">Actual</th>
                        <th className="text-right py-2 px-2">
                          {horizon === 'daily' ? 'Δ Cambio' : horizon === 'weekly' ? 'Momentum' : 'Dirección'}
                        </th>
                        <th className="text-center py-2 px-2">Tendencia</th>
                        <th className="text-right py-2 px-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((ind) => {
                        const flag = getCurrencyFlag(ind.currency)
                        const regionName = getCurrencyName(ind.currency)
                        let changeValue: string | null = null
                        let changeColor = 'text-muted-foreground'
                        if (horizon === 'daily' && ind.change != null) {
                          changeValue = ind.change >= 0 ? `+${ind.change.toFixed(2)}` : ind.change.toFixed(2)
                          changeColor = ind.change >= 0 ? 'text-green-600' : 'text-red-600'
                        } else if (horizon === 'weekly' && ind.weeklyMomentum != null) {
                          changeValue = ind.weeklyMomentum >= 0 ? `+${ind.weeklyMomentum.toFixed(2)}` : ind.weeklyMomentum.toFixed(2)
                          changeColor = ind.weeklyMomentum >= 0 ? 'text-green-600' : 'text-red-600'
                        } else if (horizon === 'monthly' && ind.monthlyTrend) {
                          changeValue =
                            ind.monthlyTrend === 'acelerando'
                              ? '↑ Acelerando'
                              : ind.monthlyTrend === 'desacelerando'
                                ? '↓ Desacelerando'
                                : '→ Estable'
                          changeColor =
                            ind.monthlyTrend === 'acelerando'
                              ? 'text-green-600'
                              : ind.monthlyTrend === 'desacelerando'
                                ? 'text-red-600'
                                : 'text-gray-600'
                        } else {
                          changeValue = '—'
                        }
                        const d = safeDate(ind.date)
                        const dateStr = d ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                        return (
                          <tr key={ind.key} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium">
                              <span className="text-xs text-muted-foreground">
                                {flag} {regionName}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              {ind.label}
                              {ind.value == null && (
                                <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400" title="Definido en config pero sin datos en snapshot">
                                  Sin datos
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right text-muted-foreground">
                              {formatValue(ind.valuePrevious ?? null, ind.unit, ind.key)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {formatValue(ind.value, ind.unit, ind.key)}
                            </td>
                            <td className={cn('py-2 px-2 text-right', changeColor)}>{changeValue ?? '—'}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={cn('font-semibold', getTrendColor(ind.trend))}>
                                {getTrendIcon(ind.trend)}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">{dateStr}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
