/**
 * Página de Liquidez v1 — FROZEN (2026-01-28)
 * Muestra el estado de liquidez global, flujo por activo, régimen y contexto de mercado.
 * No genera señales de trading, solo contexto descriptivo.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import getBiasState from '@/domain/macro-engine/bias'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import InfoTooltip from '@/components/InfoTooltip'

type LiquidityGlobalState = 'Expansiva' | 'Neutral' | 'Restrictiva'

type AssetFlow = {
  activo: string
  flujo: string
}

type LiquidityRegime = 'Expansivo' | 'Selectivo' | 'Contractivo'

function mapLiquidityRegimeToGlobalState(regime: string, score: number | null): LiquidityGlobalState {
  if (regime === 'High') return 'Expansiva'
  if (regime === 'Low' || regime === 'Contracting') return 'Restrictiva'
  return 'Neutral'
}

function mapLiquidityRegimeToRegimeType(regime: string, score: number | null): LiquidityRegime {
  if (regime === 'High') return 'Expansivo'
  if (regime === 'Low' || regime === 'Contracting') return 'Contractivo'
  return 'Selectivo'
}

function getLiquidityGlobalStateContent(state: LiquidityGlobalState): {
  texto: string
  interpretacion: string[]
} {
  switch (state) {
    case 'Expansiva':
      return {
        texto: 'El entorno actual muestra una expansión de la liquidez. El capital fluye hacia activos de riesgo, favoreciendo movimientos amplios y continuados en los mercados.',
        interpretacion: [
          'Mayor disposición al riesgo',
          'Condiciones favorables para activos cíclicos',
          'Menor presión defensiva',
        ],
      }
    case 'Restrictiva':
      return {
        texto: 'El entorno refleja una contracción de liquidez. El capital se dirige hacia activos defensivos y se reduce la exposición al riesgo.',
        interpretacion: [
          'Aumento de la aversión al riesgo',
          'Menor continuidad de movimientos',
          'Mayor sensibilidad a noticias macro',
        ],
      }
    default: // Neutral
      return {
        texto: 'La liquidez se mantiene estable, sin una dirección clara del flujo de capital. El mercado muestra un comportamiento mixto y selectivo.',
        interpretacion: [
          'Falta de convicción general',
          'Movimientos más técnicos',
          'Alternancia entre activos',
        ],
      }
  }
}

function getAssetFlows(state: LiquidityGlobalState, regime: LiquidityRegime): AssetFlow[] {
  // Flujos basados en el estado de liquidez global y régimen
  const flows: AssetFlow[] = []

  if (state === 'Expansiva') {
    flows.push(
      { activo: 'USD', flujo: 'Saliendo' },
      { activo: 'Bonos', flujo: 'Neutral' },
      { activo: 'Renta Variable', flujo: 'Entrando' },
      { activo: 'Oro', flujo: 'Neutral' },
      { activo: 'Cripto', flujo: 'Riesgo' }
    )
  } else if (state === 'Restrictiva') {
    flows.push(
      { activo: 'USD', flujo: 'Entrando' },
      { activo: 'Bonos', flujo: 'Defensivo' },
      { activo: 'Renta Variable', flujo: 'Saliendo' },
      { activo: 'Oro', flujo: 'Defensivo' },
      { activo: 'Cripto', flujo: 'Neutral' }
    )
  } else {
    // Neutral
    flows.push(
      { activo: 'USD', flujo: 'Neutral' },
      { activo: 'Bonos', flujo: 'Neutral' },
      { activo: 'Renta Variable', flujo: 'Débil' },
      { activo: 'Oro', flujo: 'Neutral' },
      { activo: 'Cripto', flujo: 'Neutral' }
    )
  }

  return flows
}

function getContextText(state: LiquidityGlobalState, regime: LiquidityRegime): string {
  if (state === 'Expansiva' && regime === 'Expansivo') {
    return 'El mercado presenta un entorno de liquidez expansiva, con flujo de capital hacia activos de riesgo y condiciones favorables para movimientos amplios y continuados.'
  }
  if (state === 'Restrictiva' && regime === 'Contractivo') {
    return 'El mercado presenta un entorno de liquidez contractiva, con preferencia por activos defensivos y un comportamiento selectivo del capital. Se observa una reducción clara del apetito por riesgo.'
  }
  if (state === 'Neutral' && regime === 'Selectivo') {
    return 'El mercado presenta un entorno de liquidez moderada, con preferencia por activos defensivos y un comportamiento selectivo del capital. No se observa una expansión clara del riesgo.'
  }
  // Combinaciones mixtas
  return 'El mercado presenta un entorno de liquidez moderada, con comportamiento selectivo del capital y movimientos técnicos. La dirección del flujo no es clara.'
}

function getFlowBadgeVariant(flujo: string): 'default' | 'secondary' | 'outline' {
  if (flujo.includes('Entrando')) return 'default'
  if (flujo.includes('Saliendo')) return 'outline'
  if (flujo.includes('Defensivo')) return 'secondary'
  if (flujo.includes('Riesgo')) return 'default'
  return 'outline'
}

/** Texto del bloque "Resumen de liquidez" según regime.liquidity (solo presentación). */
function getResumenLiquidezContent(state: LiquidityGlobalState): { tituloEstado: string; parrafo1: string; parrafo2: string } {
  switch (state) {
    case 'Expansiva':
      return {
        tituloEstado: 'Estado actual: Liquidez expansiva',
        parrafo1:
          'El entorno de liquidez muestra una expansión del capital disponible en el sistema.',
        parrafo2:
          'Este tipo de contexto suele coincidir con condiciones financieras más holgadas y mayor disponibilidad de liquidez en los mercados.',
      }
    case 'Restrictiva':
      return {
        tituloEstado: 'Estado actual: Liquidez restrictiva',
        parrafo1:
          'La liquidez del sistema se encuentra en contracción, reflejando condiciones financieras más exigentes.',
        parrafo2:
          'Este entorno suele caracterizarse por una menor disponibilidad de capital y mayor sensibilidad a los datos macroeconómicos.',
      }
    default:
      return {
        tituloEstado: 'Estado actual: Liquidez neutral',
        parrafo1:
          'La liquidez global se mantiene estable, sin una expansión ni contracción clara del flujo monetario.',
        parrafo2:
          'Este entorno suele asociarse a un mercado más selectivo, donde los movimientos dependen más de factores específicos que de un impulso monetario general.',
      }
  }
}

export default async function LiquidezPage() {
  let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
  let error: string | null = null

  try {
    biasState = await getBiasState()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const liquidityRegime = biasState?.regime.liquidity ?? 'Medium'
  const liquidityScore = biasState?.metrics.liquidityScore ?? null

  const globalState = mapLiquidityRegimeToGlobalState(liquidityRegime, liquidityScore)
  const regimeType = mapLiquidityRegimeToRegimeType(liquidityRegime, liquidityScore)
  const stateContent = getLiquidityGlobalStateContent(globalState)
  const assetFlows = getAssetFlows(globalState, regimeType)
  const contextText = getContextText(globalState, regimeType)

  const updatedAt = biasState?.updatedAt
    ? new Date(biasState.updatedAt).toISOString().slice(0, 19).replace('T', ' ')
    : '—'

  const isFallbackNeutral = !!error && globalState === 'Neutral'

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Liquidez
          <InfoTooltip text="La liquidez representa el entorno en el que se mueve el capital entre activos. No es una señal de trading, sino contexto descriptivo del mercado." />
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Estado de liquidez global, flujo por activo y régimen de mercado actual.
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          Dimensión del régimen macro: Liquidez
        </p>
        {updatedAt !== '—' && (
          <p className="text-xs text-muted-foreground mt-1">Actualizado: {updatedAt}</p>
        )}
      </div>

      {/* 1. Resumen de liquidez — dinámico según regime.liquidity */}
      {(() => {
        const resumen = getResumenLiquidezContent(globalState)
        return (
          <Card>
            <CardHeader>
              <CardTitle>Resumen de liquidez</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium text-foreground">{resumen.tituloEstado}</p>
              <p className="text-sm text-muted-foreground">{resumen.parrafo1}</p>
              <p className="text-sm text-muted-foreground">{resumen.parrafo2}</p>
            </CardContent>
          </Card>
        )
      })()}

      {/* 2. Cómo interpretar la liquidez — texto fijo */}
      <Card>
        <CardHeader>
          <CardTitle>Cómo interpretar la liquidez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            La liquidez refleja el nivel de disponibilidad de capital dentro del sistema financiero.
          </p>
          <p>Una liquidez expansiva suele acompañar entornos con mayor facilidad para el flujo de capital.</p>
          <p>Una liquidez neutral indica un equilibrio entre oferta y demanda de liquidez.</p>
          <p>Una liquidez restrictiva suele asociarse a condiciones financieras más ajustadas.</p>
          <p className="pt-2 border-t border-border italic">
            Este indicador es descriptivo, no predictivo, y no constituye una recomendación de inversión.
          </p>
        </CardContent>
      </Card>

      {/* 3. Componentes observados para el cálculo de liquidez */}
      <Card>
        <CardHeader>
          <CardTitle>Componentes observados para el cálculo de liquidez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            El estado de liquidez se evalúa a partir de distintas variables monetarias y de balance, entre ellas:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Balance de la Reserva Federal (WALCL)</li>
            <li>Operaciones Reverse Repo (RRP)</li>
            <li>Treasury General Account (TGA)</li>
            <li>Agregados monetarios (M2)</li>
          </ul>
          <p className="text-sm text-muted-foreground pt-2">
            Estas métricas permiten contextualizar el entorno de liquidez, sin representar flujos directos de inversión.
          </p>
        </CardContent>
      </Card>

      {/* Bloque informativo — mismo estilo que Macro Overview y Correlaciones */}
      <Card>
        <CardContent className="pt-6">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-base">📘</span>
              <span>¿Qué representa la liquidez del mercado?</span>
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="mt-4 space-y-4 text-sm text-muted-foreground whitespace-pre-line">
              {`📘 ¿Qué representa la liquidez del mercado?
La liquidez describe el entorno macro de flujo de capital dentro del sistema financiero.
Refleja si las condiciones monetarias favorecen o restringen la circulación de capital entre activos.
Se calcula a partir de variables monetarias y de balance (como liquidez del sistema, facilidades, reservas y agregados monetarios), y permite contextualizar el régimen macroeconómico en el que se encuentra el mercado.
Esta información es descriptiva, no predictiva, y no constituye una señal de inversión.
Su función es aportar contexto para entender el entorno macro general.`}
            </div>
          </details>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        La liquidez se muestra como una dimensión del régimen macro y no debe interpretarse como una recomendación operativa.
      </p>

      {error && (
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>No se pudieron cargar los datos de liquidez</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      )}

      {/* BLOQUE 1 — LIQUIDEZ GLOBAL */}
      <Card>
        <CardHeader>
          <CardTitle>Liquidez Global</CardTitle>
          <CardDescription>
            Estado de Liquidez (dimensión del régimen macro)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFallbackNeutral && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              No se ha podido obtener el estado actualizado de liquidez. Se muestra un estado neutral por defecto.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Estado de Liquidez (dimensión del régimen macro):
            </span>
            <div className="flex items-center gap-3">
              {globalState === 'Expansiva' && (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                  🟢 Expansiva
                </Badge>
              )}
              {globalState === 'Neutral' && (
                <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40">
                  🟡 Neutral
                </Badge>
              )}
              {globalState === 'Restrictiva' && (
                <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40">
                  🔴 Restrictiva
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-foreground">{stateContent.texto}</p>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Interpretación:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {stateContent.interpretacion.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOQUE 2 — FLUJO DE LIQUIDEZ POR ACTIVO */}
      <Card>
        <CardHeader>
          <CardTitle>Flujo de Liquidez por Activo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Activo</th>
                  <th className="text-left py-2 px-3 font-medium">Flujo</th>
                </tr>
              </thead>
              <tbody>
                {assetFlows.map((flow) => {
                  const variant = getFlowBadgeVariant(flow.flujo)
                  const badgeClass = flow.flujo.includes('Entrando')
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40'
                    : flow.flujo.includes('Saliendo')
                    ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40'
                    : flow.flujo.includes('Defensivo')
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40'
                    : flow.flujo.includes('Riesgo')
                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40'
                    : ''
                  return (
                    <tr key={flow.activo} className="border-b">
                      <td className="py-2 px-3 font-medium">{flow.activo}</td>
                      <td className="py-2 px-3">
                        <Badge variant={variant} className={badgeClass}>
                          {flow.flujo}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Definiciones:</p>
            <ul className="space-y-1">
              <li>
                <span className="font-medium">Entrando:</span> el capital fluye hacia este activo.
              </li>
              <li>
                <span className="font-medium">Saliendo:</span> el capital se retira progresivamente.
              </li>
              <li>
                <span className="font-medium">Neutral:</span> no hay flujo dominante.
              </li>
              <li>
                <span className="font-medium">Defensivo:</span> activo utilizado como refugio.
              </li>
              <li>
                <span className="font-medium">Riesgo:</span> activo sensible al apetito por riesgo.
              </li>
            </ul>
            <p className="pt-2 italic">
              Este flujo no representa volumen real, sino una lectura macro del comportamiento del capital.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* BLOQUE 3 — RÉGIMEN DE LIQUIDEZ */}
      <Card>
        <CardHeader>
          <CardTitle>Régimen de Liquidez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {regimeType === 'Expansivo' && (
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                🟢 Expansivo
              </Badge>
            )}
            {regimeType === 'Selectivo' && (
              <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40">
                🟡 Selectivo
              </Badge>
            )}
            {regimeType === 'Contractivo' && (
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40">
                🔴 Contractivo
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {regimeType === 'Expansivo' && (
              <p>
                El entorno favorece la asunción de riesgo. La liquidez fluye hacia activos de crecimiento y mercados con mayor volatilidad.
              </p>
            )}
            {regimeType === 'Selectivo' && (
              <p>
                La liquidez se dirige solo a determinados activos. El mercado discrimina y premia la fortaleza relativa.
              </p>
            )}
            {regimeType === 'Contractivo' && (
              <p>
                La liquidez se reduce. Predomina la preservación de capital y los movimientos defensivos.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BLOQUE 4 — CONTEXTO DE MERCADO */}
      <Card>
        <CardHeader>
          <CardTitle>Contexto Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{contextText}</p>
        </CardContent>
      </Card>

      {/* 4. Disclaimer final — mismo estilo que Pre-Market */}
      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        ℹ️ La información mostrada tiene carácter descriptivo y no constituye una recomendación de inversión.
        La liquidez se presenta como una dimensión del contexto macroeconómico.
      </div>
    </main>
  )
}
