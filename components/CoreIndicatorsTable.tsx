import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/utils'
import { getIndicatorRegionFlag } from '@/lib/utils/indicator-region'
import { getIndicatorConfig } from '@/config/macro-indicators'
import { safeArray, isFiniteNumber, safeDate } from '@/lib/utils/guards'
import { getIndicatorSource } from '@/lib/sources'

export interface CoreIndicator {
  key: string
  label: string
  category: 'Crecimiento' | 'Empleo' | 'Inflación' | 'Tipos/Condiciones'
  value: number | null
  previous: number | null
  date: string | null
  trend: 'acelera' | 'desacelera' | 'estable'
  importance: 'Alta' | 'Media' | 'Baja'
  unit?: string
  errorType?: 'NO_DATA' | 'MISCONFIG' | 'RATE_LIMITED' | 'SOURCE_DOWN' | 'not_available_in_source' | null
  // Campos adicionales para diferentes horizontes temporales
  change?: number | null // Δ vs anterior (Diario)
  surprise?: number | null // Sorpresa vs consenso (Diario)
  weeklyMomentum?: number | null // Momentum semanal (Semanal)
  hasNewPublication?: boolean // Si hay nueva publicación (Semanal)
  monthlyTrend?: 'acelerando' | 'desacelerando' | 'estable' // Tendencia mensual (Mensual)
}

interface CoreIndicatorsTableProps {
  indicators: CoreIndicator[]
  horizon?: 'daily' | 'weekly' | 'monthly'
}

export default function CoreIndicatorsTable({ indicators, horizon = 'daily' }: CoreIndicatorsTableProps) {
  // Guard defensivo: asegurar siempre un array tipado
  const safeIndicators = safeArray<CoreIndicator>(indicators)

  const getTrendIcon = (trend: string) => {
    if (trend === 'acelera') return '↑'
    if (trend === 'desacelera') return '↓'
    return '→'
  }

  const getTrendColor = (trend: string) => {
    if (trend === 'acelera') return 'text-green-600 dark:text-green-400'
    if (trend === 'desacelera') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getImportanceColor = (importance: string) => {
    if (importance === 'Alta') return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
    if (importance === 'Media') return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50'
    return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/50'
  }

  // FIX 2.1: Validar decimals y value antes de toFixed
  const formatValue = (value: number | null, unit?: string, errorType?: string | null, indicatorKey?: string) => {
    if (value === null) {
      // Show error type in tooltip instead of generic N/A
      if (errorType) {
        const errorLabels: Record<string, string> = {
          'NO_DATA': 'Sin datos disponibles',
          'MISCONFIG': 'Configuración incorrecta',
          'RATE_LIMITED': 'Límite de tasa alcanzado',
          'SOURCE_DOWN': 'Fuente no disponible',
          'not_available_in_source': 'No disponible en la fuente',
        }
        return errorLabels[errorType] || 'N/A'
      }
      return 'N/A'
    }
    
    // FIX 2.1: Validar que value sea número válido
    if (!isFiniteNumber(value)) {
      return '—'
    }
    
    // FIX 2.1: Validar decimals antes de usar toFixed
    if (indicatorKey) {
      try {
        const config = getIndicatorConfig(indicatorKey)
        if (config) {
          // FIX 2.1: Validar decimals antes de toFixed
          const decimals =
            typeof config.decimals === 'number' && config.decimals >= 0
              ? config.decimals
              : 0
          
          const rounded = Number(value.toFixed(decimals))
          
          switch (config.unit) {
            case 'percent':
              return `${rounded.toFixed(decimals)}%`
            case 'millions':
              return `${rounded.toFixed(decimals)}M`
            case 'thousands':
              return `${rounded.toFixed(decimals)}K`
            case 'index':
              return rounded.toString()
            case 'level':
              return rounded.toString()
            default:
              return rounded.toFixed(decimals)
          }
        }
      } catch (error) {
        // Fallback si hay error
        console.warn(`[CoreIndicatorsTable] Error formatting value for ${indicatorKey}:`, error)
      }
    }
    
    // Fallback: formato básico si no hay indicatorKey o config
    const formatted = value.toFixed(2)
    return unit ? `${formatted} ${unit}` : formatted
  }

  const getErrorTooltip = (errorType?: string | null) => {
    if (!errorType) return null
    const tooltips: Record<string, string> = {
      'NO_DATA': 'No hay datos disponibles para este indicador',
      'MISCONFIG': 'Configuración del indicador incorrecta (verificar series ID)',
      'RATE_LIMITED': 'Límite de solicitudes alcanzado en la fuente de datos',
      'SOURCE_DOWN': 'La fuente de datos no está disponible temporalmente',
      'not_available_in_source': 'Este indicador no está disponible en la fuente configurada',
    }
    return tooltips[errorType] || null
  }

  const formatChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null
    const change = current - previous
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
  }

  // Agrupar por categoría (solo indicadores con categoría válida)
  const grouped = safeIndicators.reduce<Record<string, CoreIndicator[]>>((acc, ind) => {
    if (!ind || !ind.category) return acc
    if (!acc[ind.category]) {
      acc[ind.category] = []
    }
    acc[ind.category].push(ind)
    return acc
  }, {} as Record<string, CoreIndicator[]>)

  const categoryOrder: Array<CoreIndicator['category']> = ['Crecimiento', 'Empleo', 'Inflación', 'Tipos/Condiciones']

  return (
    <Card>
      <CardHeader>
        <CardTitle>Macro Drivers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {categoryOrder.map((category) => {
            const categoryIndicators = grouped[category] || []
            if (categoryIndicators.length === 0) return null

            const categoryLabel =
              category === 'Tipos/Condiciones' ? 'Liquidity / Monetary Policy' : category

            return (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {categoryLabel}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Indicador</th>
                        <th className="text-right py-2 px-2">Dato anterior</th>
                        <th className="text-right py-2 px-2">Dato actual</th>
                        <th className="text-right py-2 px-2">
                          {horizon === 'daily' ? 'Δ Cambio' : horizon === 'weekly' ? 'Momentum' : 'Dirección'}
                        </th>
                        <th className="text-center py-2 px-2">Tendencia</th>
                        <th className="text-center py-2 px-2">Importancia</th>
                        <th className="text-right py-2 px-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryIndicators.map((ind: CoreIndicator) => {
                        // Determinar qué mostrar según horizonte temporal
                        let changeValue: string | null = null
                        let changeColor = 'text-muted-foreground'
                        
                        if (horizon === 'daily') {
                          // Diario: mostrar EXACTAMENTE el Δ que viene del backend (no inventar).
                          if (ind.change !== null && ind.change !== undefined) {
                            changeValue = ind.change >= 0 ? `+${ind.change.toFixed(2)}` : ind.change.toFixed(2)
                            changeColor = ind.change >= 0 ? 'text-green-600' : 'text-red-600'
                          } else {
                            changeValue = '—'
                            changeColor = 'text-muted-foreground'
                          }
                          // Mostrar surprise si el backend lo trae (sin calcular).
                          if (ind.surprise !== null && ind.surprise !== undefined) {
                            changeValue = `${changeValue} (surprise: ${ind.surprise > 0 ? '+' : ''}${ind.surprise.toFixed(2)})`
                          }
                        } else if (horizon === 'weekly') {
                          // Semanal: mostrar momentum
                          if (ind.weeklyMomentum !== null && ind.weeklyMomentum !== undefined) {
                            changeValue = ind.weeklyMomentum >= 0 ? `+${ind.weeklyMomentum.toFixed(2)}` : ind.weeklyMomentum.toFixed(2)
                            changeColor = ind.weeklyMomentum >= 0 ? 'text-green-600' : 'text-red-600'
                          } else if (!ind.hasNewPublication) {
                            changeValue = 'Sin nueva publicación'
                            changeColor = 'text-muted-foreground'
                          } else {
                            changeValue = '—'
                            changeColor = 'text-muted-foreground'
                          }
                        } else {
                          // Mensual: mostrar tendencia mensual
                          if (ind.monthlyTrend) {
                            changeValue = ind.monthlyTrend === 'acelerando' ? '↑ Acelerando' :
                                         ind.monthlyTrend === 'desacelerando' ? '↓ Desacelerando' : '→ Estable'
                            changeColor = ind.monthlyTrend === 'acelerando' ? 'text-green-600' :
                                         ind.monthlyTrend === 'desacelerando' ? 'text-red-600' : 'text-gray-600'
                          } else {
                            changeValue = '—'
                            changeColor = 'text-muted-foreground'
                          }
                        }
                        
                        const regionFlag = getIndicatorRegionFlag(ind.key)
                        const sourceInfo = getIndicatorSource(ind.key)
                        
                        return (
                          <tr key={ind.key} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{ind.label}</span>
                                {regionFlag && (
                                  <span className="text-xs text-muted-foreground">{regionFlag}</span>
                                )}
                                {sourceInfo?.sourceUrl && (
                                  <a
                                    href={sourceInfo.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    title={`Fuente oficial: ${sourceInfo.source}`}
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                      />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right text-muted-foreground">
                              {formatValue(ind.previous, ind.unit)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span 
                                title={ind.value === null ? getErrorTooltip(ind.errorType) || undefined : undefined}
                                className={ind.value === null && ind.errorType ? 'text-orange-600 dark:text-orange-400 cursor-help' : ''}
                              >
                                {formatValue(ind.value, ind.unit, ind.errorType, ind.key)}
                              </span>
                            </td>
                            <td className={cn('py-2 px-2 text-right', changeColor)}>
                              {changeValue || '—'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={cn('font-semibold', getTrendColor(ind.trend))}>
                                {getTrendIcon(ind.trend)}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Badge className={getImportanceColor(ind.importance)} variant="outline">
                                {ind.importance}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                              {/* FIX 2.3: Validar fecha antes de formatear */}
                              {(() => {
                                const d = safeDate(ind.date)
                                return d ? d.toLocaleDateString('es-ES', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric' 
                                }) : '—'
                              })()}
                            </td>
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
