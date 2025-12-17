'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReliabilityStatus } from '@/domain/macro-engine/reliability'

type ReliabilityTrafficLightProps = {
  status: ReliabilityStatus
  message: string
  details: {
    percentWeakening: number
    percentBreak: number
    hasUpcomingHighImpactNews: boolean
    upcomingHighImpactEvents: Array<{ title: string; time: string | null }>
    hasHighImpactLaterToday: boolean
    highImpactLaterToday: Array<{ title: string; time: string | null }>
    regimeSwitchInLast24h: boolean
  }
}

export default function ReliabilityTrafficLight({
  status,
  message,
  details,
}: ReliabilityTrafficLightProps) {
  const statusConfig = {
    normal: {
      emoji: '🟢',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-400',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-green-500 text-white',
    },
    caution: {
      emoji: '🟡',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      badgeVariant: 'outline' as const,
      badgeClass: 'bg-yellow-500 text-white',
    },
    chaos: {
      emoji: '🔴',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-700',
      badgeVariant: 'destructive' as const,
      badgeClass: 'bg-red-500 text-white',
    },
  }

  const config = statusConfig[status]

  return (
    <Card className={cn('shadow-md', config.borderColor, 'border-2')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Semáforo de Fiabilidad del Sistema</CardTitle>
          <Badge className={config.badgeClass}>{config.emoji} {status === 'normal' ? 'Normal' : status === 'caution' ? 'Precaución' : 'Caos'}</Badge>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', config.bgColor, 'rounded-lg p-4')}>
        <div>
          <p className={cn('text-lg font-semibold mb-2', config.textColor)}>
            {config.emoji} {message}
          </p>
          <p className="text-sm text-muted-foreground">
            ¿Me puedo fiar del sistema hoy?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Correlaciones debilitándose: </span>
            <span className="font-semibold">{details.percentWeakening}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rupturas de régimen: </span>
            <span className="font-semibold">{details.percentBreak}%</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Noticias próximas: </span>
            {details.hasUpcomingHighImpactNews ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                Sí — {details.upcomingHighImpactEvents[0]?.title}
                {details.upcomingHighImpactEvents[0]?.time && ` (${details.upcomingHighImpactEvents[0].time})`}
              </span>
            ) : details.hasHighImpactLaterToday ? (
              <span className="font-semibold">
                No (pero hay eventos de alto impacto más tarde hoy:{' '}
                {details.highImpactLaterToday.map((e, idx) => (
                  <span key={idx}>
                    {e.title}
                    {e.time && ` ${e.time}`}
                    {idx < details.highImpactLaterToday.length - 1 ? ', ' : ''}
                  </span>
                ))})
              </span>
            ) : (
              <span className="font-semibold">No</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Cambio de régimen: </span>
            <span className="font-semibold">{details.regimeSwitchInLast24h ? 'Sí' : 'No'}</span>
          </div>
        </div>
        {status === 'normal' && (
          <p className="text-xs text-muted-foreground italic">
            ✅ Señales fiables — puedes operar con confianza
          </p>
        )}
        {status === 'caution' && (
          <p className="text-xs text-muted-foreground italic">
            ⚠️ Reduce tamaño de posición y mantén stops ajustados
          </p>
        )}
        {status === 'chaos' && (
          <p className="text-xs text-muted-foreground italic">
            🚨 Evita nuevas exposiciones — espera a que se estabilice el mercado
          </p>
        )}
      </CardContent>
    </Card>
  )
}









