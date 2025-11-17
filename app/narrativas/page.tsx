import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { validateBiasRowFinal } from '@/lib/types/bias-final'
import { formatSignedTwoDecimals } from '@/lib/utils/format'
import { logger } from '@/lib/obs/logger'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type NarrativeRow = {
  par: string
  tactico: string
  accion: string
  confianza: string
  motivo: string
  corrRef: string
  corr12m: number | null
  corr3m: number | null
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

function buildNarrativeRows(tableTactical: any[], correlationShifts: any[]): NarrativeRow[] {
  const shiftBySymbol = new Map<string, any>()

  for (const shift of correlationShifts) {
    const symbolKey = normalizeSymbol(shift?.symbol)
    if (!symbolKey) continue
    shiftBySymbol.set(symbolKey, shift)
  }

  return tableTactical.map((row) => {
    const normalized = normalizeSymbol(row?.pair || row?.symbol)
    const shift = normalized ? shiftBySymbol.get(normalized) : undefined

    return {
      par: row?.pair ?? row?.symbol ?? shift?.symbol ?? '—',
      tactico: row?.trend ?? row?.tactico ?? 'Neutral',
      accion: row?.action ?? row?.accion ?? 'Rango/táctico',
      confianza: row?.confidence ?? row?.confianza ?? 'Media',
      motivo: row?.motive ?? row?.motivo ?? 'Sin narrativa disponible.',
      corrRef: shift?.benchmark ?? row?.benchmark ?? 'DXY',
      corr12m: row?.corr12m ?? shift?.corr12m ?? null,
      corr3m: row?.corr3m ?? shift?.corr3m ?? null,
    }
  })
}

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

export default async function NarrativasPage() {
  let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
  let correlationState: Awaited<ReturnType<typeof getCorrelationState>> | null = null
  let error: string | null = null

  try {
    const results = await Promise.all([
      getBiasState().catch((err) => {
        logger.error('[NarrativasPage] getBiasState failed', { error: err instanceof Error ? err.message : String(err) })
        throw err
      }),
      getCorrelationState().catch((err) => {
        logger.error('[NarrativasPage] getCorrelationState failed', { error: err instanceof Error ? err.message : String(err) })
        throw err
      }),
    ])
    biasState = results[0]
    correlationState = results[1]
  } catch (err) {
    error = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
    logger.error('[NarrativasPage] Failed to load data', { error })
  }

  if (error || !biasState || !correlationState) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error al cargar datos</h2>
          <p className="text-sm text-red-800">{error || 'Error desconocido'}</p>
          <p className="text-xs text-red-700 mt-2">Por favor, intenta recargar la página o contacta al administrador.</p>
        </div>
      </main>
    )
  }

  const tacticalRows = Array.isArray(biasState.tableTactical) ? biasState.tableTactical : []
  const rows: NarrativeRow[] = buildNarrativeRows(tacticalRows, correlationState.shifts)

  const usd = USD_LABELS[biasState.regime.usd_direction] ?? biasState.regime.usd_direction
  const quad = biasState.regime.quad
  const overallRegime = biasState.regime.overall
  const liquidity = biasState.regime.liquidity
  const credit = biasState.regime.credit
  const risk = biasState.regime.risk

  if (!rows.length) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">No hay narrativas disponibles. Los datos se actualizan automáticamente con el cálculo de bias.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header con explicación extensa */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
        </p>

        {/* Sección explicativa */}
        <div className="rounded-lg border bg-card p-6 mb-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">¿Qué son las Narrativas Macroeconómicas?</h2>
          
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              Las narrativas macroeconómicas son el conjunto de factores fundamentales que determinan la dirección y la fuerza de los movimientos de precios en los mercados financieros. A diferencia del análisis técnico, que se basa en patrones de precios históricos, las narrativas macro se fundamentan en datos económicos reales y su interpretación por parte de los participantes institucionales del mercado.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">¿Por qué son importantes?</h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                Los traders institucionales (bancos, fondos de inversión, hedge funds) basan sus decisiones en narrativas macro. Cuando una narrativa es clara y consistente, puede generar movimientos de precios significativos y sostenidos. Entender estas narrativas te permite anticipar movimientos antes de que ocurran y posicionarte en la misma dirección que los grandes participantes del mercado.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2">Narrativas Alcistas</h4>
                <p className="text-sm text-muted-foreground">
                  Se generan cuando los datos macroeconómicos sugieren fortaleza económica, crecimiento sostenido, o políticas monetarias favorables. Los activos tienden a subir cuando la narrativa es alcista y la correlación con el USD es negativa.
                </p>
              </div>
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2">Narrativas Bajistas</h4>
                <p className="text-sm text-muted-foreground">
                  Aparecen cuando los datos muestran debilidad económica, recesión, o políticas restrictivas. Los activos tienden a caer cuando la narrativa es bajista y hay una correlación positiva con el USD.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Explicación de componentes */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Componentes de una Narrativa</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-green-700">Tendencia</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Indica la dirección esperada del precio basada en la narrativa macro:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Alcista:</strong> Expectativa de subida</li>
                <li><strong>Bajista:</strong> Expectativa de caída</li>
                <li><strong>Rango/Neutral:</strong> Sin dirección clara</li>
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-blue-700">Acción</h3>
              <p className="text-sm text-muted-foreground mb-2">
                La recomendación operativa basada en la narrativa:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Comprar:</strong> Posicionarse largo</li>
                <li><strong>Vender:</strong> Posicionarse corto</li>
                <li><strong>Esperar:</strong> No operar hasta claridad</li>
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-purple-700">Confianza</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Probabilidad de que la narrativa se materialice:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Alta:</strong> 70-80% probabilidad</li>
                <li><strong>Media:</strong> 50-60% probabilidad</li>
                <li><strong>Baja:</strong> &lt;50% probabilidad</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Explicación de correlaciones */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Correlaciones y su Interpretación</h2>
          
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              Las correlaciones muestran qué tan relacionado está un activo con el USD (DXY). Esta relación es crucial para entender cómo reaccionará el activo cuando cambie la narrativa del dólar.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                <h4 className="font-semibold text-red-900 mb-2">Correlación Positiva (+)</h4>
                <p className="text-red-800 text-sm leading-relaxed mb-2">
                  El activo se mueve en la misma dirección que el USD:
                </p>
                <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                  <li>USD sube → Activo sube</li>
                  <li>USD baja → Activo baja</li>
                  <li>Ejemplo: EUR/USD típicamente tiene correlación positiva</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Correlación Negativa (-)</h4>
                <p className="text-green-800 text-sm leading-relaxed mb-2">
                  El activo se mueve en dirección opuesta al USD:
                </p>
                <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                  <li>USD sube → Activo baja</li>
                  <li>USD baja → Activo sube</li>
                  <li>Ejemplo: Oro (XAU/USD) típicamente tiene correlación negativa</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Ventanas Temporales</h4>
              <p className="text-yellow-800 text-sm leading-relaxed mb-2">
                Las correlaciones se calculan en diferentes ventanas temporales:
              </p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                <li><strong>3 meses:</strong> Correlación a corto plazo (más volátil, refleja movimientos recientes)</li>
                <li><strong>12 meses:</strong> Correlación a medio-largo plazo (más estable, refleja la relación estructural)</li>
                <li>Una divergencia entre 3m y 12m puede indicar un cambio en la relación fundamental</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Contexto macro actual */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Contexto Macroeconómico Actual</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Régimen General</div>
            <div className="text-lg font-semibold">{overallRegime}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">USD</div>
            <div className="text-lg font-semibold">{usd}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Cuadrante</div>
            <div className="text-lg font-semibold">{quad}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Liquidez</div>
            <div className="text-lg font-semibold">{liquidity}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Crédito</div>
            <div className="text-lg font-semibold">{credit}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Apetito de Riesgo</div>
            <div className="text-lg font-semibold">{risk}</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Última actualización: {biasState.updatedAt ? new Date(biasState.updatedAt).toLocaleString('es-ES') : 'N/A'}
        </div>
      </div>

      {/* Grid de narrativas */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Narrativas por Activo</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Haz clic en cualquier activo para ver el análisis detallado de su narrativa macroeconómica
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r: any) => {
            // Construir contrato final y validarlo (hardening)
            const contractInput = {
              symbol: r?.par,
              trend_final: r?.tactico === 'Neutral' ? 'Neutral' : r?.tactico,
              action_final: r?.accion,
              confidence_level: r?.confianza,
              motivo_macro: r?.motivo,
              corr_ref: r?.corrRef || 'DXY',
              corr_12m: r?.corr12m,
              corr_3m: r?.corr3m,
            }
            const validated = validateBiasRowFinal(contractInput)
            const isInvalid = !validated.ok
            if (isInvalid) {
              const meta: Record<string, unknown> = { symbol: r?.par, error: (validated as any).error }
              logger.warn('[Narrativas] BiasRowFinal inválido', meta)
            }

            // Datos ya validados (o fallback si inválido)
            const trend_final = validated.ok ? validated.data.trend_final : contractInput.trend_final
            const action_final = validated.ok ? validated.data.action_final : contractInput.action_final
            const confidence_level = validated.ok ? validated.data.confidence_level : contractInput.confidence_level
            const motivo_macro = validated.ok ? validated.data.motivo_macro : contractInput.motivo_macro
            const corr_ref = validated.ok ? validated.data.corr_ref : contractInput.corr_ref
            const corr_12m = validated.ok ? validated.data.corr_12m : contractInput.corr_12m
            const corr_3m = validated.ok ? validated.data.corr_3m : contractInput.corr_3m

            const trendBadge =
              trend_final === 'Alcista'
                ? 'bg-emerald-600/10 text-emerald-700 border-emerald-200'
                : trend_final === 'Bajista'
                ? 'bg-rose-600/10 text-rose-700 border-rose-200'
                : 'bg-gray-500/10 text-gray-700 border-gray-200' // Rango/Neutral

            const confBadge =
              confidence_level === 'Alta'
                ? 'bg-green-600/10 text-green-700 border-green-200'
                : confidence_level === 'Media'
                ? 'bg-amber-600/10 text-amber-700 border-amber-200'
                : 'bg-gray-500/10 text-gray-700 border-gray-200'

            const symbol = r.par
            const href = `/narrativas/${symbol.replace('/', '')}` as const

            if (isInvalid || Number.isNaN(corr_12m) || Number.isNaN(corr_3m)) {
              return (
                <div key={symbol} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-lg">{symbol}</h2>
                  </div>
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    Error: datos incompletos para Narrativas (revisar motor de sesgos).
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={symbol}
                href={href}
                className="rounded-lg border bg-card p-5 hover:border-primary hover:shadow-md transition-all block"
              >
                {/* Header con símbolo y badge */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-xl">{symbol}</h2>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${trendBadge}`}>
                    {trend_final === 'Neutral' ? 'Rango' : trend_final}
                  </span>
                </div>

                {/* Narrativa principal */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-foreground mb-2">Narrativa Macro:</div>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded p-3">
                    {motivo_macro}
                  </div>
                </div>

                {/* Acción recomendada */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-900 font-medium mb-1">Acción Recomendada:</div>
                  <div className="text-sm font-semibold text-blue-900">{action_final}</div>
                </div>

                {/* Métricas */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Confianza:</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${confBadge}`}>
                      {confidence_level}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Corr. 12m:</span>
                      <span className="ml-1 font-medium">{formatSignedTwoDecimals(corr_12m)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Corr. 3m:</span>
                      <span className="ml-1 font-medium">{formatSignedTwoDecimals(corr_3m)}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Referencia: {corr_ref}
                  </div>
                </div>

                {/* Link para más detalles */}
                <div className="mt-4 pt-3 border-t text-xs text-primary text-center">
                  Ver análisis detallado →
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Sección de interpretación */}
      <div className="rounded-lg border bg-card p-6 mt-8">
        <h2 className="text-2xl font-semibold mb-4">Cómo Interpretar las Narrativas</h2>
        
        <div className="space-y-4 text-sm">
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">1. Prioriza Narrativas con Alta Confianza</h3>
            <p className="text-muted-foreground leading-relaxed">
              Las narrativas con confianza alta tienen mayor probabilidad de materializarse. Estas son las que los traders institucionales están siguiendo más de cerca y donde es más probable que veas movimientos significativos.
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">2. Considera la Correlación con el USD</h3>
            <p className="text-muted-foreground leading-relaxed">
              Si el USD está fuerte (narrativa alcista) y un activo tiene correlación negativa alta, es muy probable que ese activo caiga. Por el contrario, si el USD está débil y el activo tiene correlación positiva, el activo probablemente subirá.
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">3. Observa Divergencias entre Correlaciones</h3>
            <p className="text-muted-foreground leading-relaxed">
              Si la correlación a 3 meses difiere significativamente de la correlación a 12 meses, puede indicar un cambio estructural en la relación. Esto puede ser una oportunidad o una señal de precaución.
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">4. Combina con Análisis Técnico</h3>
            <p className="text-muted-foreground leading-relaxed">
              Las narrativas macro te dan la dirección, pero el análisis técnico te ayuda a encontrar el mejor punto de entrada. Usa las narrativas para filtrar operaciones y el análisis técnico para el timing.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
