export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable } from '@/domain/bias'
import { getCorrelations } from '@/domain/corr-dashboard'

export async function GET() {
  const diag = await getMacroDiagnosis()
  const usd = usdBias(diag.items)
  const quad = macroQuadrant(diag.items)
  const bias = getBiasTable(diag.regime, usd, quad)
  const corr = await getCorrelations()

  const lines: string[] = []
  // Header
  lines.push('section,type,key,label,value,unit,date,weight,posture')
  for (const i of diag.items as any[]) {
    lines.push(['items', 'indicator', i.key, i.label, i.value ?? '', i.unit ?? '', i.date ?? '', i.weight ?? '', i.posture ?? ''].join(','))
  }
  lines.push('section,par,sesgoMacro,accion,motivo')
  for (const r of bias) {
    lines.push(['bias', r.par, r.sesgoMacro, r.accion, r.motivo].map(v => String(v).replaceAll(',', ';')).join(','))
  }
  lines.push('section,activo,corr12,corr24,señal,comentario')
  for (const r of corr) {
    lines.push(['corr', r.activo, r.corr12 ?? '', r.corr24 ?? '', r.señal, r.comentario.replaceAll(',', ';')].join(','))
  }

  const csv = lines.join('\n')
  const filename = `export_${new Date().toISOString().slice(0,10)}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}


