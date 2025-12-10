'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { ExposureOverlap } from '@/domain/macro-engine/exposure'

type ExposureOverlapProps = {
  exposure: ExposureOverlap
}

export default function ExposureOverlap({ exposure }: ExposureOverlapProps) {
  const renderBar = (side: { label: string; percentage: number; trades: string[] }) => {
    const isAlert = side.percentage > 60
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{side.label}</span>
          <span className={cn('font-bold', isAlert && 'text-red-600 dark:text-red-400')}>
            {side.percentage}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 flex items-center justify-end pr-2',
              isAlert ? 'bg-red-500' : 'bg-primary'
            )}
            style={{ width: `${side.percentage}%` }}
          >
            {side.percentage > 10 && (
              <span className="text-xs text-white font-semibold">
                {side.trades.length} {side.trades.length === 1 ? 'trade' : 'trades'}
              </span>
            )}
          </div>
        </div>
        {side.trades.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {side.trades.join(', ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Solapamiento de Exposición</CardTitle>
        <CardDescription>
          ¿Estás apostando varias veces lo mismo sin darte cuenta?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {exposure.alert && (
          <Alert variant="destructive">
            <AlertDescription>{exposure.alert}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          {renderBar(exposure.usdStrong)}
          {renderBar(exposure.usdWeak)}
          {renderBar(exposure.neutral)}
        </div>
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Calculado basado en correlaciones con DXY y relevancia macro. 
            Si una barra supera el 60%, considera diversificar tu exposición.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
