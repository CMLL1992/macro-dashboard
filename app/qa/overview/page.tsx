export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Link from 'next/link'
import universeAssets from '@/config/universe.assets.json'
import { getMacroBias } from '@/lib/db/read'
import { evaluateAllInvariants } from '@/lib/quality/invariants'

export default function QAOverviewPage() {
  const rows = (universeAssets as any[]).map((a) => {
    const mb = getMacroBias(a.symbol)
    if (!mb) return { symbol: a.symbol, report: null }
    const report = evaluateAllInvariants({ symbol: a.symbol, bias: mb.bias, nowTs: new Date().toISOString() })
    return { symbol: a.symbol, report }
  })

  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">QA Overview</h1>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-2">Símbolo</th>
              <th className="py-2 pr-2">PASS</th>
              <th className="py-2 pr-2">WARN</th>
              <th className="py-2 pr-2">FAIL</th>
              <th className="py-2 pr-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-t">
                <td className="py-2 pr-2">{r.symbol}</td>
                <td className="py-2 pr-2">{r.report?.counts.pass ?? '-'}</td>
                <td className="py-2 pr-2">{r.report?.counts.warn ?? '-'}</td>
                <td className="py-2 pr-2">{r.report?.counts.fail ?? '-'}</td>
                <td className="py-2 pr-2">
                  <Link className="underline" href={`/qa/asset/${r.symbol}`}>Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}




