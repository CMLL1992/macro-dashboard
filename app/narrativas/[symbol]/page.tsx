import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { validateBiasRowFinal } from '@/lib/types/bias-final'
import { formatSignedTwoDecimals } from '@/lib/utils/format'
import { logger } from '@/lib/obs/logger'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getIndicatorHistory } from '@/lib/db/read'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

function getMarketExplanation(symbol: string, usd: 'Fuerte' | 'Débil' | 'Neutral', quadrant: string, corr12m: number | null, corr3m: number | null): string {
  const symbolUpper = symbol.toUpperCase()
  
  // Explicación específica por tipo de activo
  if (symbolUpper.includes('EUR/USD') || symbolUpper.includes('EURUSD')) {
    return `El EUR/USD es el par de divisas más líquido del mundo y representa la relación entre el euro y el dólar estadounidense. Su movimiento está fuertemente influenciado por las políticas monetarias del BCE y la Fed, así como por los diferenciales de tipos de interés. Cuando el USD está ${usd.toLowerCase()}, el EUR/USD típicamente se mueve en dirección ${corr12m && corr12m < 0 ? 'opuesta' : 'similar'}, reflejando la dinámica de flujos de capital entre las dos economías más grandes del mundo.`
  }
  
  if (symbolUpper.includes('GBP/USD') || symbolUpper.includes('GBPUSD')) {
    return `El GBP/USD, conocido como "Cable", refleja la relación entre la libra esterlina y el dólar. Es particularmente sensible a las decisiones del Banco de Inglaterra y a los datos económicos del Reino Unido. La correlación con el USD es ${corr12m && Math.abs(corr12m) > 0.5 ? 'fuerte' : 'moderada'}, lo que significa que los movimientos del dólar tienen un impacto ${corr12m && corr12m < 0 ? 'inverso' : 'directo'} en este par.`
  }
  
  if (symbolUpper.includes('XAU/USD') || symbolUpper.includes('XAUUSD') || symbolUpper.includes('GOLD')) {
    return `El oro (XAU/USD) es considerado un activo refugio y una cobertura contra la inflación. Típicamente tiene una correlación ${corr12m && corr12m < 0 ? 'negativa' : 'positiva'} con el USD, lo que significa que cuando el dólar está fuerte, el oro tiende a ${corr12m && corr12m < 0 ? 'caer' : 'subir'}. En el cuadrante actual (${quadrant}), el oro puede servir como protección contra ${quadrant === 'estanflacion' || quadrant === 'desaceleracion' ? 'la debilidad económica' : 'la inflación'}.`
  }
  
  if (symbolUpper.includes('BTC/USDT') || symbolUpper.includes('BTCUSDT') || symbolUpper.includes('BTC')) {
    return `Bitcoin (BTC/USDT) es un activo de riesgo que se comporta de manera similar a los activos de riesgo tradicionales. Su correlación con el USD es ${corr12m && Math.abs(corr12m) > 0.5 ? 'significativa' : 'moderada'}, lo que indica que los movimientos del dólar ${corr12m && corr12m < 0 ? 'afectan inversamente' : 'afectan directamente'} a Bitcoin. En un entorno de ${usd === 'Fuerte' ? 'USD fuerte' : usd === 'Débil' ? 'USD débil' : 'USD neutral'}, Bitcoin tiende a comportarse como un activo de riesgo.`
  }
  
  if (symbolUpper.includes('SPX') || symbolUpper.includes('SP500')) {
    return `El S&P 500 (SPX) es el índice de referencia de las acciones estadounidenses. Su correlación con el USD es ${corr12m && corr12m < 0 ? 'negativa' : 'positiva'}, lo que refleja que un dólar fuerte puede ${corr12m && corr12m < 0 ? 'presionar' : 'apoyar'} a las empresas exportadoras. El cuadrante macroeconómico actual (${quadrant}) influye en las expectativas de crecimiento corporativo y rentabilidad.`
  }
  
  // Explicación genérica
  return `Este activo muestra una correlación ${corr12m && Math.abs(corr12m) > 0.5 ? 'fuerte' : corr12m && Math.abs(corr12m) > 0.3 ? 'moderada' : 'débil'} con el USD (${corr12m && corr12m < 0 ? 'negativa' : 'positiva'}). En el contexto macroeconómico actual, con USD ${usd.toLowerCase()} y cuadrante ${quadrant}, este activo refleja las dinámicas fundamentales del mercado.`
}

function getCorrelationExplanation(corr12m: number | null, corr3m: number | null, corrRef: string): string {
  if (corr12m == null && corr3m == null) {
    return `No hay datos de correlación disponibles para este activo con ${corrRef}. Esto puede deberse a que el activo es relativamente nuevo o no tiene suficiente historial de datos.`
  }
  
  const abs12 = Math.abs(corr12m ?? 0)
  const abs3 = Math.abs(corr3m ?? 0)
  
  let explanation = `La correlación con ${corrRef} muestra `
  
  if (abs12 >= 0.7) {
    explanation += `una relación muy fuerte a largo plazo (12 meses: ${formatSignedTwoDecimals(corr12m ?? 0)}). `
  } else if (abs12 >= 0.5) {
    explanation += `una relación fuerte a largo plazo (12 meses: ${formatSignedTwoDecimals(corr12m ?? 0)}). `
  } else if (abs12 >= 0.3) {
    explanation += `una relación moderada a largo plazo (12 meses: ${formatSignedTwoDecimals(corr12m ?? 0)}). `
  } else {
    explanation += `una relación débil a largo plazo (12 meses: ${formatSignedTwoDecimals(corr12m ?? 0)}). `
  }
  
  if (corr12m && corr12m < 0) {
    explanation += `Esta correlación negativa significa que cuando ${corrRef} sube, este activo tiende a bajar, y viceversa. `
  } else if (corr12m && corr12m > 0) {
    explanation += `Esta correlación positiva significa que cuando ${corrRef} sube, este activo tiende a subir también, y viceversa. `
  }
  
  if (corr3m != null && corr12m != null) {
    const diff = Math.abs(corr3m - corr12m)
    if (diff > 0.2) {
      explanation += `Hay una divergencia significativa entre la correlación a corto plazo (3 meses: ${formatSignedTwoDecimals(corr3m)}) y largo plazo (12 meses: ${formatSignedTwoDecimals(corr12m)}), lo que puede indicar un cambio en la relación fundamental entre este activo y ${corrRef}. `
    } else {
      explanation += `La correlación a corto plazo (3 meses: ${formatSignedTwoDecimals(corr3m)}) es consistente con la de largo plazo, lo que sugiere una relación estable. `
    }
  }
  
  explanation += `Estas correlaciones se calculan usando datos históricos de precios y reflejan cómo se han movido estos activos en relación entre sí.`
  
  return explanation
}

function getDriverExplanation(drivers: any[], usd: 'Fuerte' | 'Débil' | 'Neutral'): string {
  if (!drivers || drivers.length === 0) {
    return `Los drivers macroeconómicos son los indicadores clave que influyen en la dirección del mercado. En el contexto actual con USD ${usd.toLowerCase()}, los principales factores que están impulsando los movimientos del mercado incluyen el crecimiento económico, la inflación, y las expectativas de política monetaria.`
  }
  
  let explanation = `Los drivers mostrados son los indicadores macroeconómicos más importantes que están influyendo en la narrativa actual. Estos drivers se seleccionan basándose en su peso e impacto en el sesgo del mercado. `
  
  explanation += `En el contexto actual con USD ${usd.toLowerCase()}, los drivers principales son: `
  
  const driverNames = drivers.slice(0, 3).map(d => d.label || d.key).join(', ')
  explanation += driverNames + '. '
  
  explanation += `Estos indicadores se ponderan según su importancia histórica y su capacidad para predecir movimientos del mercado. Los valores actuales y anteriores de estos drivers se comparan para determinar si están en una postura "Hawkish" (restrictiva), "Dovish" (acomodaticia), o "Neutral" (neutral), lo que influye directamente en la narrativa macroeconómica.`
  
  return explanation
}

export default async function NarrativeDetailPage({ params }: { params: { symbol: string } }) {
  const symbolParam = decodeURIComponent(params.symbol || '')
  const requested = normalizeSymbol(symbolParam)

  const [biasState, correlationState] = await Promise.all([
    getBiasState(),
    getCorrelationState(),
  ])

  const tacticalRows = Array.isArray(biasState.tableTactical) ? biasState.tableTactical : []
  const tacticalRow = tacticalRows.find(
    (row: any) => normalizeSymbol(row?.pair || row?.symbol) === requested
  )

  if (!tacticalRow) {
    notFound()
  }

  const shift =
    correlationState.shifts.find(
      (s) => normalizeSymbol(s.symbol) === requested
    ) ?? null

  const displaySymbol = tacticalRow.pair ?? tacticalRow.symbol ?? symbolParam.toUpperCase()
  const usd = USD_LABELS[biasState.regime.usd_direction] ?? 'Neutral'
  const quad = biasState.regime.quad

  const candidate = {
    symbol: displaySymbol,
    trend_final: tacticalRow?.trend ?? tacticalRow?.tactico ?? 'Neutral',
    action_final: tacticalRow?.action ?? tacticalRow?.accion,
    confidence_level: tacticalRow?.confidence ?? tacticalRow?.confianza,
    motivo_macro: tacticalRow?.motive ?? tacticalRow?.motivo,
    corr_ref: shift?.benchmark ?? tacticalRow?.benchmark ?? 'DXY',
    corr_12m: tacticalRow?.corr12m ?? shift?.corr12m ?? null,
    corr_3m: tacticalRow?.corr3m ?? shift?.corr3m ?? null,
  }

  const validated = validateBiasRowFinal(candidate)
  const isInvalid = !validated.ok || Number.isNaN(candidate.corr_12m) || Number.isNaN(candidate.corr_3m)
  if (isInvalid) {
    const meta: Record<string, unknown> = { symbol: displaySymbol, error: (validated as any).error }
    logger.warn('[NarrativaDetalle] BiasRowFinal inválido', meta)
  }

  const trend_final = validated.ok ? validated.data.trend_final : candidate.trend_final
  const action_final = validated.ok ? validated.data.action_final : candidate.action_final
  const confidence_level = validated.ok ? validated.data.confidence_level : candidate.confidence_level
  const motivo_macro = validated.ok ? validated.data.motivo_macro : candidate.motivo_macro
  const corr_ref = validated.ok ? validated.data.corr_ref : candidate.corr_ref
  const corr_12m = validated.ok ? validated.data.corr_12m : candidate.corr_12m
  const corr_3m = validated.ok ? validated.data.corr_3m : candidate.corr_3m

  // Obtener drivers (top 3)
  const drivers = (biasState.table ?? [])
    .filter((item: any) => item.posture && item.posture !== 'Neutral')
    .sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 3)
    .map((item: any) => ({
      key: item.originalKey || item.key,
      label: item.label,
      value: item.value,
      posture: item.posture,
      weight: item.weight || 0,
    }))

  const direccionBadge = trend_final === 'Alcista' 
    ? 'bg-emerald-600/10 text-emerald-700 border-emerald-200' 
    : trend_final === 'Bajista' 
    ? 'bg-rose-600/10 text-rose-700 border-rose-200' 
    : 'bg-gray-500/10 text-gray-700 border-gray-200'
  
  const confBadge = confidence_level === 'Alta' 
    ? 'bg-green-600/10 text-green-700 border-green-200' 
    : confidence_level === 'Media' 
    ? 'bg-amber-600/10 text-amber-700 border-amber-200' 
    : 'bg-gray-500/10 text-gray-700 border-gray-200'

  // Generar explicaciones
  const marketExplanation = getMarketExplanation(displaySymbol, usd, quad, corr_12m ?? null, corr_3m ?? null)
  const correlationExplanation = getCorrelationExplanation(corr_12m ?? null, corr_3m ?? null, corr_ref)
  const driverExplanation = getDriverExplanation(drivers, usd)

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <Link href="/narrativas" className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
          ← Volver a narrativas
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">{displaySymbol}</h1>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold border ${direccionBadge}`}>
            {trend_final === 'Neutral' ? 'Rango' : trend_final}
          </span>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold border ${confBadge}`}>
            Confianza: {confidence_level}
          </span>
        </div>
      </div>

      {isInvalid ? (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-2">{displaySymbol}</h2>
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Error: datos incompletos para Narrativas (revisar motor de sesgos).
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Narrativa principal */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Narrativa Macroeconómica</h2>
            <div className="space-y-4">
              <div className="text-base leading-relaxed bg-muted/30 rounded-lg p-4">
                <p className="font-medium mb-2">Resumen:</p>
                <p>{motivo_macro} ⇒ {action_final}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tendencia:</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs border ${direccionBadge}`}>
                    {trend_final === 'Neutral' ? 'Rango' : trend_final}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Confianza:</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs border ${confBadge}`}>
                    {confidence_level}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
                <div>Correlación 12m: {formatSignedTwoDecimals(corr_12m)} ({corr_ref})</div>
                <div>Correlación 3m: {formatSignedTwoDecimals(corr_3m)} ({corr_ref})</div>
              </div>
            </div>
          </div>

          {/* Explicación del mercado */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Explicación del Mercado</h2>
            <p className="text-sm leading-relaxed text-foreground">
              {marketExplanation}
            </p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Contexto macroeconómico actual:</strong> El mercado se encuentra en un entorno de USD {usd.toLowerCase()} y cuadrante {quad}. Esta combinación de factores fundamentales está impulsando la narrativa {trend_final?.toLowerCase() || 'neutral'} para este activo.
              </p>
            </div>
          </div>

          {/* Explicación de correlaciones */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">¿Por qué se muestran estas correlaciones?</h2>
            <p className="text-sm leading-relaxed text-foreground mb-4">
              {correlationExplanation}
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Correlación 12 meses</div>
                <div className="text-lg font-semibold">{formatSignedTwoDecimals(corr_12m)}</div>
                <div className="text-xs text-muted-foreground mt-1">Relación a largo plazo</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Correlación 3 meses</div>
                <div className="text-lg font-semibold">{formatSignedTwoDecimals(corr_3m)}</div>
                <div className="text-xs text-muted-foreground mt-1">Relación a corto plazo</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Nota:</strong> Las correlaciones se calculan usando datos históricos de precios mensuales. Una correlación alta (|r| &gt; 0.5) indica una relación fuerte, mientras que una correlación baja (|r| &lt; 0.3) indica una relación débil o independiente.
              </p>
            </div>
          </div>

          {/* Drivers y explicación */}
          {drivers.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold mb-4">Drivers Macroeconómicos Principales</h2>
              <p className="text-sm leading-relaxed text-foreground mb-4">
                {driverExplanation}
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                {drivers.map((driver, idx) => {
                  const history = getIndicatorHistory(driver.key)
                  const postureBadge = driver.posture === 'Hawkish'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : driver.posture === 'Dovish'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                  
                  return (
                    <div key={idx} className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-sm font-semibold mb-2">{driver.label || driver.key}</div>
                      <div className="text-xs text-muted-foreground mb-2">Postura: <span className={`px-2 py-0.5 rounded text-xs border ${postureBadge}`}>{driver.posture}</span></div>
                      {driver.value != null && (
                        <div className="text-lg font-semibold mb-1">
                          {driver.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {history?.value_previous != null && (
                        <div className="text-xs text-muted-foreground">
                          Anterior: {history.value_previous.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Peso: {(driver.weight * 100).toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Implicaciones operativas */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Implicaciones para el Trading</h2>
            <div className="space-y-3 text-sm">
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Estrategia Recomendada</h3>
                <p className="text-foreground leading-relaxed">
                  Basándote en la narrativa {trend_final?.toLowerCase() || 'neutral'} con confianza {confidence_level?.toLowerCase() || 'media'}, la acción recomendada es <strong>{action_final}</strong>. Esta recomendación se basa en el análisis de múltiples factores macroeconómicos y su impacto histórico en este activo.
                </p>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Gestión de Riesgo</h3>
                <p className="text-foreground leading-relaxed">
                  Con una confianza {confidence_level?.toLowerCase() || 'media'}, es importante gestionar el riesgo adecuadamente. Si la confianza es alta, puedes considerar posiciones más grandes, pero siempre con stop-loss. Si la confianza es media o baja, reduce el tamaño de la posición y espera confirmación con price action.
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Vigilancia de Cambios</h3>
                <p className="text-foreground leading-relaxed">
                  Las narrativas macroeconómicas pueden cambiar cuando se publican nuevos datos económicos importantes. Monitorea especialmente los drivers principales mostrados arriba, ya que cambios significativos en estos indicadores pueden alterar la narrativa y la recomendación.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
