import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import InfoTooltip from '@/components/InfoTooltip'
import { cn } from '@/components/ui/utils'
import type { TimeHorizon } from './MacroOverviewTabs'

interface RegimeGlobalCardProps {
  risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
  usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
  growthTrend: 'acelerando' | 'desacelerando' | 'estable' | null
  inflationTrend: 'acelerando' | 'desacelerando' | 'estable' | null
  confidence: 'Alta' | 'Media' | 'Baja'
  confidenceExplanation?: string
  topDrivers?: Array<{ key: string; label: string; reason: string }>
  horizon?: TimeHorizon
}

export default function RegimeGlobalCard({
  risk,
  usdDirection,
  growthTrend,
  inflationTrend,
  confidence,
  confidenceExplanation,
  topDrivers = [],
  horizon = 'daily',
}: RegimeGlobalCardProps) {
  const CONFIDENCE_TOOLTIP_TEXT = `🔹 ¿Qué significa la Confianza?
La confianza indica el grado de fiabilidad del régimen macro actual.
No mide si el mercado es “bueno o malo”, sino qué tan claras y consistentes son las señales macroeconómicas.

🔸 Cómo se calcula
La confianza se basa en:
Número de indicadores que apuntan en la misma dirección
Importancia de esos indicadores
Consistencia entre crecimiento, empleo e inflación
Estabilidad del cambio (no ruido puntual)

🔸 Niveles de confianza
Alta → La mayoría de indicadores confirman el mismo escenario
Media → Hay señales mixtas o en transición
Baja → Datos contradictorios o falta de confirmación

📌 Una confianza alta significa que el régimen es más fiable.
📌 Una confianza baja indica mayor incertidumbre y riesgo de cambio.`

  const DRIVERS_TOOLTIP_TEXT = `🔹 ¿Qué son los Drivers principales?
Los Drivers principales son los indicadores macroeconómicos que más están influyendo en el régimen actual.
No son todos los indicadores, solo los más relevantes en este momento.

🔸 Cómo se seleccionan
Se eligen en función de:
Magnitud del cambio reciente
Importancia del indicador
Impacto histórico en el ciclo económico
Relación con crecimiento, empleo o inflación

🔸 Qué representa cada línea
Ejemplo:
Nóminas No Agrícolas (NFP): Cambio de +169K
Significa:
Ese indicador ha cambiado de forma relevante
Está influyendo en el régimen actual
Ayuda a explicar por qué el sistema clasifica el entorno como Risk ON / OFF / Neutral

🔸 Orden de los drivers
El orden refleja impacto relativo, no importancia teórica:
Mayor impacto reciente
Mayor contribución al cambio de régimen
Mayor peso macroeconómico

ℹ️ Importante
Los drivers no son señales de trading
No implican dirección inmediata del mercado
Explican el contexto macro, no el timing
Cambian cuando cambian los datos reales`

  const getRiskColor = (risk: string) => {
    if (risk === 'Risk ON') return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50'
    if (risk === 'Risk OFF') return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
    return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50'
  }

  const getUsdColor = (direction: string) => {
    if (direction === 'Fuerte') return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/50'
    if (direction === 'Débil') return 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/50'
    return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/50'
  }

  const getTrendColor = (trend: string) => {
    if (trend === 'acelerando') return 'text-green-600 dark:text-green-400'
    if (trend === 'desacelerando') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getConfidenceColor = (conf: string) => {
    if (conf === 'Alta') return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50'
    if (conf === 'Media') return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50'
    return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Régimen Global
          <InfoTooltip text="Estado macroeconómico dominante del mercado" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Risk ON/OFF */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Apetito por Riesgo</div>
            <Badge className={getRiskColor(risk)} variant="outline">
              {risk === 'Risk ON' ? 'Risk ON' : risk === 'Risk OFF' ? 'Risk OFF' : 'Neutral'}
            </Badge>
          </div>

          {/* USD Direction */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">USD</div>
            <Badge className={getUsdColor(usdDirection)} variant="outline">
              {usdDirection}
            </Badge>
          </div>

          {/* Growth Trend */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Crecimiento</div>
            <div className={cn('text-sm font-semibold', growthTrend ? getTrendColor(growthTrend) : 'text-muted-foreground')}>
              {growthTrend === 'acelerando' ? '↑ Acelerando' : growthTrend === 'desacelerando' ? '↓ Desacelerando' : growthTrend === 'estable' ? '→ Estable' : '—'}
            </div>
          </div>

          {/* Inflation Trend */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Inflación</div>
            <div className={cn('text-sm font-semibold', inflationTrend ? getTrendColor(inflationTrend) : 'text-muted-foreground')}>
              {inflationTrend === 'acelerando' ? '↑ Acelerando' : inflationTrend === 'desacelerando' ? '↓ Desacelerando' : inflationTrend === 'estable' ? '→ Estable' : '—'}
            </div>
          </div>
        </div>

        {/* Drivers Principales */}
        {Array.isArray(topDrivers) && topDrivers.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <span>
                Drivers principales ({horizon === 'daily' ? 'cambios recientes' : horizon === 'weekly' ? 'confirmación' : 'régimen dominante'}):
              </span>
              <InfoTooltip text={DRIVERS_TOOLTIP_TEXT} />
            </div>
            <ul className="space-y-1 text-sm">
              {topDrivers.map((driver, idx) => {
                // FIX: Validar estructura de driver antes de renderizar
                if (!driver || typeof driver.key !== 'string' || typeof driver.label !== 'string') {
                  return null
                }
                return (
                  <li key={driver.key} className="flex items-start gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <span className="font-medium">{driver.label}:</span>
                    <span className="text-muted-foreground">{driver.reason || ''}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Confidence */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">Confianza:</div>
            <Badge className={getConfidenceColor(confidence)} variant="outline">
              {confidence}
            </Badge>
            <InfoTooltip
              text={CONFIDENCE_TOOLTIP_TEXT}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
