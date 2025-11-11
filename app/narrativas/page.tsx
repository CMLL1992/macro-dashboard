import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable, getBiasTableTactical } from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'
import { BiasRowFinalSchema, validateBiasRowFinal } from '@/lib/types/bias-final'
import { formatSignedTwoDecimals } from '@/lib/utils/format'
import { logger } from '@/lib/obs/logger'
import Link from 'next/link'

export const revalidate = 10800 // 3h

export default async function NarrativasPage() {
  // Obtener exactamente las mismas filas finales que usa el Mapa de sesgos
  const data = await getMacroDiagnosisWithDelta()
  const usd = usdBias(data.items)
  const quad = macroQuadrant(data.items)
  // biasRows solo para heredar orden si fuera necesario (p. ej., prioridad)
  const biasRows = getBiasTable(data.regime, usd, quad)
  const corrMap = await getCorrMap()
  const tacticalRows = await getBiasTableTactical(
    data.items as any[],
    data.regime,
    usd,
    data.score,
    [],
    corrMap
  )

  // Asegurar mismo orden que el Mapa (orden por las propias filas tácticas)
  const rows = tacticalRows

  if (!rows.length) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Narrativas semanales</h1>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">No hay narrativas disponibles. Los datos se actualizan automáticamente con el cálculo de bias.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Narrativas semanales</h1>
        <p className="text-muted-foreground">Análisis macroeconómico por activo basado en datos actuales</p>
      </div>

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
              ? 'bg-emerald-600/10 text-emerald-700'
              : trend_final === 'Bajista'
              ? 'bg-rose-600/10 text-rose-700'
              : 'bg-gray-500/10 text-gray-700' // Rango/Neutral

          const confBadge =
            confidence_level === 'Alta'
              ? 'bg-green-600/10 text-green-700'
              : confidence_level === 'Media'
              ? 'bg-amber-600/10 text-amber-700'
              : 'bg-gray-500/10 text-gray-700'

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
              className="rounded-lg border bg-card p-4 hover:border-primary transition-colors block"
            >
              {/* Badge Tendencia */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-lg">{symbol}</h2>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${trendBadge}`}>
                  {trend_final === 'Neutral' ? 'Rango' : trend_final}
                </span>
              </div>

              {/* Plantilla fija */}
              <div className="text-sm space-y-2">
                <div className="whitespace-pre-line">
                  {motivo_macro} ⇒ {action_final}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground" aria-label="Confianza">Confianza:</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${confBadge}`} title={`Confianza ${confidence_level}`}>
                    {confidence_level}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Corr. 12m: {formatSignedTwoDecimals(corr_12m)} ({corr_ref})
                </div>
                <div className="text-xs text-muted-foreground">
                  Corr. 3m: {formatSignedTwoDecimals(corr_3m)} ({corr_ref})
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
