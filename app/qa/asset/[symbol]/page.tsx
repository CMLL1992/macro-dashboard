import { notFound } from 'next/navigation'
import universeAssets from '@/config/universe.assets.json'
import { getMacroBias } from '@/lib/db/read'
import type { AssetMeta } from '@/lib/bias/types'
import { summarize, usdLogicInvariant, rowLabelsFromBias } from '@/lib/quality/invariants'

export default async function QAAssetPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase()
  const asset = (universeAssets as AssetMeta[]).find((a) => a.symbol === symbol)
  if (!asset) return notFound()

  const biasRes = getMacroBias(symbol)
  const bias = biasRes?.bias || null

  let invSummary = { pass: 0, warn: 0, fail: 0, results: [] as any[] }
  if (bias) {
    const inv = [
      usdLogicInvariant(bias, symbol.endsWith('USD') && !symbol.startsWith('USD')),
    ]
    invSummary = summarize(inv)
  }

  const labels = bias ? rowLabelsFromBias(bias) : { tendencia: '-', accion: '-', confianza: '-' }

  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">QA — {symbol}</h1>

        {/* Bias */}
        <div className="rounded border p-4">
          <h2 className="font-semibold mb-2">MacroBias</h2>
          {bias ? (
            <div className="text-sm space-y-1">
              <div>Score: {bias.score.toFixed(1)} | Dir: {bias.direction} | Conf: {(bias.confidence*100).toFixed(0)}%</div>
              <div>Cobertura: {bias.meta?.drivers_used}/{bias.meta?.drivers_total} | Coherencia: {(bias.meta?.coherence ?? 0.5).toFixed(2)}</div>
              <div>Labels: Tendencia {labels.tendencia} | Acción {labels.accion} | Confianza {labels.confianza}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin bias en cache</div>
          )}
        </div>

        {/* Invariants */}
        <div className="rounded border p-4">
          <h2 className="font-semibold mb-2">Invariantes</h2>
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className="text-green-700">PASS {invSummary.pass}</span>
            <span className="text-yellow-700">WARN {invSummary.warn}</span>
            <span className="text-red-700">FAIL {invSummary.fail}</span>
          </div>
          <ul className="text-sm list-disc list-inside">
            {invSummary.results.map((r, i) => (
              <li key={i} className={r.level==='FAIL'?'text-red-700':r.level==='WARN'?'text-yellow-700':'text-green-700'}>
                [{r.level}] {r.name}: {r.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}




