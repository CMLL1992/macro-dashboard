export const dynamic = 'force-dynamic'

import getCorrelationState, {
  type CorrelationTrend,
} from '@/domain/macro-engine/correlations'
import getBiasState from '@/domain/macro-engine/bias'
import CorrelationTooltip from '@/components/CorrelationTooltip'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function trendLabel(trend: CorrelationTrend) {
  switch (trend) {
    case 'Strengthening':
      return 'Fortaleciéndose'
    case 'Weakening':
      return 'Debilitándose'
    case 'Stable':
      return 'Estable'
    default:
      return 'Inconcluso'
  }
}

const SHIFT_LABELS: Record<string, string> = {
  Break: 'Rompimiento',
  Reinforcing: 'Reforzando',
  Stable: 'Estable',
  Weak: 'Débil',
}

export default async function CorrelationsPage() {
  const [correlationState, biasState] = await Promise.all([
    getCorrelationState(),
    getBiasState(),
  ])

  const { benchmark, summary, shifts, windows } = correlationState

  const getShiftFor = (symbol: string, bench: string) =>
    shifts.find((s) => s.symbol === symbol && s.benchmark === bench)

  return (
    <div className="space-y-6 p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle>Correlaciones macro</CardTitle>
          <CardDescription>
            Cómo se relacionan los activos con el benchmark {benchmark} en distintas ventanas temporales y qué significa para el régimen actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Régimen actual:{' '}
            <strong>{biasState.regime.risk}</strong> · USD{' '}
            <strong>{biasState.regime.usd_direction}</strong> · Quad{' '}
            <strong>{biasState.regime.quad}</strong>
          </p>
          <p>
            Las correlaciones se calculan en ventanas {windows.join(', ')} y se comparan para detectar cambios de régimen (“breaks”), refuerzos o estabilidad.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>¿Qué es la correlación?</CardTitle>
          <CardDescription>
            Valores cercanos a +1 indican movimientos en la misma dirección que {benchmark}; cercanos a -1, movimientos inversos; y valores próximos a 0, independencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            - Correlación positiva fuerte (&gt; 0.6): el activo tiende a moverse igual que el benchmark.
            <br />
            - Correlación negativa fuerte (&lt; -0.6): el activo actúa como cobertura natural.
            <br />
            - Correlaciones débiles (&lt; |0.3|): movimientos más independientes, útiles para diversificación.
          </p>
          <p>
            Comparar ventanas cortas vs largas ayuda a detectar posibles cambios estructurales. Cuando la ventana de 3 meses se separa significativamente de la de 12 meses, puede anticipar un cambio de régimen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de correlaciones</CardTitle>
          <CardDescription>
            Cada fila representa un activo frente a {benchmark}, con la ventana más relevante, tendencia reciente y una puntuación de relevancia macro (0–1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Benchmark</TableHead>
                  <TableHead>Ventana más fuerte</TableHead>
                  <TableHead>Correlación actual</TableHead>
                  <TableHead>Tendencia</TableHead>
                  <TableHead>Régimen</TableHead>
                  <TableHead>Relevancia macro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => {
                  const shift = getShiftFor(row.symbol, row.benchmark)
                  const corrNow =
                    row.correlationNow != null
                      ? row.correlationNow.toFixed(2)
                      : '–'
                  const relevancePct = Math.round(
                    row.macroRelevanceScore * 100
                  )

                  return (
                    <TableRow key={`${row.symbol}-${row.benchmark}`}>
                      <TableCell className="font-mono text-xs">
                        {row.symbol}
                      </TableCell>
                      <TableCell>{row.benchmark}</TableCell>
                      <TableCell>{row.strongestWindow ?? '–'}</TableCell>
                      <TableCell>
                        {row.correlationNow != null ? (
                          <CorrelationTooltip
                            correlation={row.correlationNow}
                            symbol={row.symbol}
                            window="3m"
                            corr12m={shift?.corr12m ?? null}
                            corr3m={shift?.corr3m ?? null}
                          >
                            <span className="cursor-help font-mono">
                              {corrNow}
                            </span>
                          </CorrelationTooltip>
                        ) : (
                          '–'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {trendLabel(row.trend)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {shift ? (
                          <Badge
                            className={cn(
                              'text-xs',
                              shift.regime === 'Break' &&
                                'bg-destructive text-destructive-foreground',
                              shift.regime === 'Reinforcing' &&
                                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                              shift.regime === 'Stable' && 'bg-muted',
                              shift.regime === 'Weak' && 'opacity-60'
                            )}
                          >
                            {SHIFT_LABELS[shift.regime] ?? shift.regime}
                          </Badge>
                        ) : (
                          '–'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${relevancePct}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {relevancePct}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

