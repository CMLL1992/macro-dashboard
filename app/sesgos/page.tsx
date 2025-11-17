export const dynamic = 'force-dynamic'
export const revalidate = 0

import getTradingBiasState, {
  type AssetTradingBias,
  type TradingBiasSide,
} from '@/domain/macro-engine/trading-bias'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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

function sideLabel(side: TradingBiasSide) {
  switch (side) {
    case 'Long':
      return 'Sólo compras'
    case 'Short':
      return 'Sólo ventas'
    default:
      return 'Neutral'
  }
}

function sideBadgeVariant(side: TradingBiasSide): 'default' | 'outline' {
  switch (side) {
    case 'Long':
      return 'default'
    case 'Short':
      return 'default'
    default:
      return 'outline'
  }
}

function convictionColor(conviction: string) {
  const c = conviction.toLowerCase()
  if (c.includes('alta')) return 'text-emerald-600 dark:text-emerald-400'
  if (c.includes('baja')) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

export default async function SesgosPage() {
  const tradingBiasState = await getTradingBiasState()
  const { regime, biases, metadata, updatedAt } = tradingBiasState
  const hasBiases = Array.isArray(biases) && biases.length > 0

  return (
    <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Sesgos operativos de trading</CardTitle>
          <CardDescription>
            Sesgos Long/Short/Neutral por activo, basados en el régimen macro actual y en las narrativas tácticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Régimen global: <strong>{regime.overall}</strong> · Riesgo{' '}
            <strong>{regime.risk}</strong> · USD{' '}
            <strong>{regime.usd_direction}</strong> · Quad{' '}
            <strong>{regime.quad}</strong> · Liquidez{' '}
            <strong>{regime.liquidity}</strong>
          </p>
          <p>
            Benchmark de correlaciones: <strong>{metadata.benchmark}</strong> · Ventanas:{' '}
            {metadata.windows.join(', ')} · Última actualización:{' '}
            <strong>{updatedAt.toLocaleString('es-ES')}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo usar esta tabla</CardTitle>
          <CardDescription>
            Esta vista NO ejecuta operaciones. Resume el sesgo macro por activo para que tú apliques tu price action sólo donde el contexto acompaña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Sólo compras</strong>: buscar setups alcistas, evitar cortos estructurales.
            </li>
            <li>
              <strong>Sólo ventas</strong>: buscar setups bajistas, evitar largos estructurales.
            </li>
            <li>
              <strong>Neutral</strong>: el macro no aporta ventaja clara; si operas, que sea más táctico/corto plazo.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesgos por activo</CardTitle>
          <CardDescription>
            Cada fila representa un activo con su sesgo operativo, nivel de convicción, narrativa macro y flags de riesgo relevantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasBiases ? (
            <p className="text-sm text-muted-foreground">
              No hay sesgos disponibles. Asegúrate de que los jobs de bias y correlaciones se han ejecutado recientemente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead>Sesgo</TableHead>
                    <TableHead>Convicción</TableHead>
                    <TableHead>Narrativa macro</TableHead>
                    <TableHead>Correlación</TableHead>
                    <TableHead>Flags de riesgo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {biases.map((b: AssetTradingBias) => {
                    const corrText =
                      b.corr12m != null
                        ? `${b.corrRef} 12m ${b.corr12m.toFixed(2)}`
                        : '—'

                    return (
                      <TableRow key={b.symbol}>
                        <TableCell className="font-mono text-xs">
                          {b.symbol}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sideBadgeVariant(b.side)}>
                            {sideLabel(b.side)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-sm font-medium', convictionColor(b.conviction))}>
                            {b.conviction}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xl">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {b.macroNarrative}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {corrText}
                          </span>
                        </TableCell>
                        <TableCell>
                          {b.riskFlags && b.riskFlags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {b.riskFlags.map((f) => (
                                <Badge
                                  key={f.id}
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    f.severity === 'High' && 'border-red-500 text-red-600 dark:text-red-300',
                                    f.severity === 'Medium' && 'border-amber-500 text-amber-600 dark:text-amber-300',
                                    f.severity === 'Low' && 'border-slate-400 text-slate-600 dark:text-slate-300'
                                  )}
                                >
                                  {f.label}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin flags relevantes
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

