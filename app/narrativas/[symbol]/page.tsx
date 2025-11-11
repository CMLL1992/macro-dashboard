import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable, getBiasTableTactical } from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'
import { validateBiasRowFinal } from '@/lib/types/bias-final'
import { formatSignedTwoDecimals } from '@/lib/utils/format'
import { logger } from '@/lib/obs/logger'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 10800 // 3h

export default async function NarrativeDetailPage({ params }: { params: { symbol: string } }) {
  // Obtener mismas filas finales que el Mapa de sesgos
  const data = await getMacroDiagnosisWithDelta()
  const usd = usdBias(data.items)
  const quad = macroQuadrant(data.items)
  // biasRows podría definir prioridades; mantenemos por consistencia si se necesitara
  const _biasRows = getBiasTable(data.regime, usd, quad)
  const corrMap = await getCorrMap()
  const tacticalRows = await getBiasTableTactical(
    data.items as any[],
    data.regime,
    usd,
    data.score,
    [],
    corrMap
  )

  // Normalización del símbolo de ruta: mayúsculas, quitar '/' para comparar
  const requested = String(params.symbol || '').toUpperCase().replace('/', '')
  // Buscar el activo por slug de ruta (p. ej., EURUSD)
  const row = tacticalRows.find((r: any) => r.par && r.par.toUpperCase().replace('/', '') === requested)

  if (!row) {
    notFound()
  }

  // Validación runtime del contrato
  const candidate = {
    symbol: row?.par,
    trend_final: row?.tactico === 'Neutral' ? 'Neutral' : row?.tactico,
    action_final: row?.accion,
    confidence_level: row?.confianza,
    motivo_macro: row?.motivo,
    corr_ref: row?.corrRef || 'DXY',
    corr_12m: row?.corr12m,
    corr_3m: row?.corr3m,
  }
  const validated = validateBiasRowFinal(candidate)
  const isInvalid = !validated.ok || Number.isNaN(candidate.corr_12m) || Number.isNaN(candidate.corr_3m)
  if (isInvalid) {
    const meta: Record<string, unknown> = { symbol: row?.par, error: (validated as any).error }
    logger.warn('[NarrativaDetalle] BiasRowFinal inválido', meta)
  }

  const trend_final = validated.ok ? validated.data.trend_final : candidate.trend_final
  const action_final = validated.ok ? validated.data.action_final : candidate.action_final
  const confidence_level = validated.ok ? validated.data.confidence_level : candidate.confidence_level
  const motivo_macro = validated.ok ? validated.data.motivo_macro : candidate.motivo_macro
  const corr_ref = validated.ok ? validated.data.corr_ref : candidate.corr_ref
  const corr_12m = validated.ok ? validated.data.corr_12m : candidate.corr_12m
  const corr_3m = validated.ok ? validated.data.corr_3m : candidate.corr_3m

  const direccionBadge = trend_final === 'Alcista' 
    ? 'bg-emerald-600/10 text-emerald-700' 
    : trend_final === 'Bajista' 
    ? 'bg-rose-600/10 text-rose-700' 
    : 'bg-gray-500/10 text-gray-700'
  
  const confBadge = confidence_level === 'Alta' 
    ? 'bg-green-600/10 text-green-700' 
    : confidence_level === 'Media' 
    ? 'bg-amber-600/10 text-amber-700' 
    : 'bg-gray-500/10 text-gray-700'

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/narrativas" className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
          ← Volver a narrativas
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold tracking-tight">{row.par}</h1>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${direccionBadge}`}>
            {trend_final === 'Neutral' ? 'Rango' : trend_final}
          </span>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${confBadge}`}>
            {confidence_level}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Plantilla fija */}
        {isInvalid ? (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-2">{row.par}</h2>
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              Error: datos incompletos para Narrativas (revisar motor de sesgos).
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-6">
            <div className="space-y-4">
              {/* Badge Tendencia ya mostrado en el header */}

              {/* Texto principal */}
              <div className="text-base">
                {motivo_macro} ⇒ {action_final}
              </div>

              {/* Confianza */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confianza:</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${confBadge}`}>
                  {confidence_level}
                </span>
              </div>

              {/* Correlaciones */}
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Corr. 12m: {formatSignedTwoDecimals(corr_12m)} ({corr_ref})</div>
                <div>Corr. 3m: {formatSignedTwoDecimals(corr_3m)} ({corr_ref})</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

