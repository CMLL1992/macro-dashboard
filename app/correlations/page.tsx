export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCorrelations } from "@/domain/corr-dashboard";
import CorrelationTooltip from "@/components/CorrelationTooltip";
import { usdBias } from "@/domain/bias";
import { getAllLatest } from "@/lib/fred";

export default async function CorrelationsPage() {
  const rows = await getCorrelations().catch((e) => {
    return { __error: String(e) } as any;
  });

  if ((rows as any).__error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold mb-3">Correlaciones con USD amplio</h1>
        <div className="rounded-lg border p-4 text-sm text-red-600 bg-red-50">
          Error cargando correlaciones: {(rows as any).__error}
        </div>
      </div>
    );
  }

  // Obtener sesgo USD para los tooltips
  const latestPoints = await getAllLatest()
  const usd = usdBias(latestPoints)

  const formatCorrCell = (value: number | null | undefined, window: '3m' | '6m' | '12m' | '24m', symbol: string, row: any) => {
    if (value == null || typeof value !== 'number') {
      return <span className="text-muted-foreground">n/a</span>
    }
    return (
      <CorrelationTooltip 
        correlation={value} 
        symbol={symbol} 
        window={window} 
        usdBias={usd}
        corr12m={row.corr12}
        corr3m={row.corr3}
      >
        <span className="cursor-help">{value.toFixed(2)}</span>
      </CorrelationTooltip>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold mb-3">Correlaciones con USD amplio (mensual)</h1>
      <p className="text-sm text-muted-foreground mb-4">Ventanas: 3m, 6m, 12m y 24m. Fuente: FRED / Stooq / Binance. Pasa el ratón sobre cada valor para ver la interpretación.</p>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Activo</th>
              <th className="text-left p-2">3m</th>
              <th className="text-left p-2">6m</th>
              <th className="text-left p-2">12m</th>
              <th className="text-left p-2">24m</th>
              <th className="text-left p-2">Señal</th>
              <th className="text-left p-2">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.activo}</td>
                <td className="p-2">{formatCorrCell(r.corr3, '3m', r.activo, r)}</td>
                <td className="p-2">{formatCorrCell(r.corr6, '6m', r.activo, r)}</td>
                <td className="p-2">{formatCorrCell(r.corr12, '12m', r.activo, r)}</td>
                <td className="p-2">{formatCorrCell(r.corr24, '24m', r.activo, r)}</td>
                <td className="p-2">{r.señal}</td>
                <td className="p-2 text-muted-foreground">{r.comentario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
