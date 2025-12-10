'use client'

import { Badge } from '@/components/ui/badge'
import SmartTooltip from '@/components/SmartTooltip'
import { cn } from '@/lib/utils'
import type { HistoricalConfidence } from '@/domain/macro-engine/historical-confidence'

type HistoricalConfidenceBadgeProps = {
  confidence: HistoricalConfidence | null
}

export default function HistoricalConfidenceBadge({
  confidence,
}: HistoricalConfidenceBadgeProps) {
  if (!confidence) {
    return (
      <SmartTooltip
        content="No hay suficientes datos históricos para calcular confianza"
        placement="top"
        maxWidth={280}
      >
        <Badge variant="outline" className="text-xs cursor-help">
          Sin historial
        </Badge>
      </SmartTooltip>
    )
  }

  const { confidencePct, totalSignals, successfulSignals } = confidence

  const getColor = (pct: number) => {
    if (pct >= 65) return 'bg-emerald-500 text-white'
    if (pct >= 50) return 'bg-yellow-500 text-white'
    return 'bg-red-500 text-white'
  }

  const getLabel = (pct: number) => {
    if (pct >= 65) return 'Alta'
    if (pct >= 50) return 'Media'
    return 'Baja'
  }

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">Confianza histórica: {confidencePct}%</p>
      <p>
        Basado en {totalSignals} señales anteriores
      </p>
      <p>
        {successfulSignals} de {totalSignals} señales fueron exitosas
      </p>
      {confidencePct < 50 && (
        <p className="text-red-600 dark:text-red-400 font-semibold mt-2">
          ⚠️ No tomar como señal dominante
        </p>
      )}
    </div>
  )

  return (
    <SmartTooltip
      content={tooltipContent}
      placement="top"
      maxWidth={320}
    >
      <Badge className={cn('text-xs cursor-help', getColor(confidencePct))}>
        Confianza histórica: {confidencePct}% ({getLabel(confidencePct)})
      </Badge>
    </SmartTooltip>
  )
}
