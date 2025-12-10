export const dynamic = 'force-dynamic'
export const revalidate = 0

import getTradingBiasState, {
  type AssetTradingBias,
  type TradingBiasSide,
} from '@/domain/macro-engine/trading-bias'
import { calculateExposureOverlap } from '@/domain/macro-engine/exposure'
import { calculateHistoricalConfidenceBatch } from '@/domain/macro-engine/historical-confidence'
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
import { Accordion } from '@/components/ui/accordion'
import ExposureOverlap from '@/components/ExposureOverlap'
import HistoricalConfidenceBadge from '@/components/HistoricalConfidenceBadge'

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

  // Calcular confianza histórica para todos los símbolos
  const symbols = hasBiases ? biases.map((b) => b.symbol) : []
  const historicalConfidenceMap = await calculateHistoricalConfidenceBatch(symbols)

  // Calcular solapamiento de exposición (por ahora vacío, el usuario puede añadir trades)
  // TODO: En el futuro, esto podría venir de una API o input del usuario
  const exposureOverlap = await calculateExposureOverlap([])

  return (
    <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Explicación de la página Sesgos */}
      <Accordion 
        title="🧩 ¿Qué muestra esta página?"
        description="Guía completa para entender los sesgos tácticos y cómo usarlos"
      >
        <div className="space-y-4 text-sm text-foreground">
          <div>
            <h3 className="font-semibold mb-2">1️⃣ ¿Qué es un Sesgo Táctico?</h3>
            <p className="mb-2">
              Un sesgo táctico es la dirección macro sugerida para un activo basada en:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>El régimen macro global (Risk ON/OFF, USD direction, cuadrante)</li>
              <li>Los scores macro de cada moneda del par</li>
              <li>Las correlaciones históricas con el benchmark (DXY)</li>
              <li>El impacto de los últimos eventos económicos</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2️⃣ Columnas de la Tabla</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Activo:</strong> El par de divisas analizado (ej: EURUSD, GBPUSD)</li>
              <li><strong>Sesgo:</strong> Long (Alcista), Short (Bajista), o Neutral</li>
              <li><strong>Convicción:</strong> Alta/Media/Baja - qué tan fuerte es la señal macro</li>
              <li><strong>Narrativa macro:</strong> Explicación del razonamiento detrás del sesgo</li>
              <li><strong>Correlación:</strong> Relación histórica con DXY (benchmark)</li>
              <li><strong>Flags de riesgo:</strong> Alertas que pueden afectar el sesgo</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3️⃣ Cómo Interpretar los Sesgos</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Sólo compras (Long):</strong> El contexto macro favorece movimientos alcistas. Busca setups alcistas.</li>
              <li><strong>Sólo ventas (Short):</strong> El contexto macro favorece movimientos bajistas. Busca setups bajistas.</li>
              <li><strong>Neutral:</strong> Señales mixtas. Prioriza análisis técnico y trading táctico.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">4️⃣ Niveles de Convicción</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Alta:</strong> Múltiples factores macro alineados, correlaciones fuertes → mayor confianza</li>
              <li><strong>Media:</strong> Sesgo presente pero con menos fuerza → considerar factores adicionales</li>
              <li><strong>Baja:</strong> Sesgo débil o mixto → usar con precaución, combinar con análisis técnico</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">5️⃣ Flags de Riesgo</h3>
            <p className="mb-2">
              Alertas que indican situaciones que requieren atención:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Correlation Break:</strong> La correlación histórica se ha roto</li>
              <li><strong>Liquidez ajustada:</strong> Condiciones de liquidez restringidas</li>
              <li><strong>Sesgo desactualizado:</strong> No se ha actualizado tras eventos recientes</li>
              <li><strong>Confianza baja:</strong> Señales débiles o contradictorias</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              <strong>Severidad:</strong> Alto (rojo), Medio (amarillo), Bajo (gris)
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">6️⃣ Cómo Usar los Sesgos</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Identifica el régimen global (arriba de la página)</li>
              <li>Selecciona activos con sesgo claro y alta convicción</li>
              <li>Lee la narrativa macro para entender el razonamiento</li>
              <li>Verifica flags de riesgo antes de operar</li>
              <li>Combina con análisis técnico para timing de entrada</li>
            </ol>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Importante</p>
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              Los sesgos <strong>NO son señales de entrada</strong>. Son contexto macro que debes combinar con análisis técnico, 
              gestión de riesgo y criterio personal. Tú decides tus operaciones.
            </p>
          </div>
        </div>
      </Accordion>

      {/* Solapamiento de Exposición */}
      <ExposureOverlap exposure={exposureOverlap} />

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
                    <TableHead>Confianza histórica</TableHead>
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
                        <TableCell>
                          <HistoricalConfidenceBadge
                            confidence={historicalConfidenceMap.get(b.symbol) || null}
                          />
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

