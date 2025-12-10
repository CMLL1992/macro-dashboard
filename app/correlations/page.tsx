import React from "react"
import getCorrelationState from "@/domain/macro-engine/correlations"
import { CorrelationsIntroCard } from "@/components/CorrelationsIntroCard"
import { getAssetCategorySafe } from "@/lib/assets"

export default async function CorrelationsPage() {
  const state: any = await getCorrelationState()

  const benchmark: string = String(state?.benchmark ?? "Benchmark")
  const summaryRaw = state?.summary
  const rowsRaw: any[] = Array.isArray(summaryRaw)
    ? summaryRaw
    : Array.isArray(state?.shifts)
    ? state.shifts
    : []
  const summary: string =
    typeof summaryRaw === "string"
      ? summaryRaw
      : `Correlaciones calculadas para ${rowsRaw.length} pares frente a ${benchmark}.`

  const updatedAtRaw = state?.updatedAt
  const updatedAt =
    typeof updatedAtRaw === "string" || updatedAtRaw instanceof Date
      ? new Date(updatedAtRaw)
      : null
  const updatedAtLabel = updatedAt
    ? updatedAt.toISOString().slice(0, 19).replace("T", " ")
    : "—"

  // Función para extraer la moneda base de un símbolo (igual que en TacticalTablesClient)
  const getBaseCurrency = (symbol: string): string | null => {
    // Normalizar símbolo: quitar espacios, barras y convertir a mayúsculas
    const normalized = symbol.toUpperCase().trim().replace(/\s+/g, '').replace(/\//g, '')
    
    // Intentar formato "EURUSD" (sin barra) - extraer primeros 3 caracteres
    if (normalized.length >= 6) {
      return normalized.substring(0, 3)
    }
    
    // Fallback: intentar con regex para formato "EUR/USD" o similar
    const match = normalized.match(/^([A-Z]{3})/)
    return match ? match[1] : null
  }

  // Orden de monedas base preferido (igual que en el dashboard)
  const currencyOrder = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF', 'XAU', 'XAG']
  
  // Orden de categorías (igual que en el dashboard)
  const categoryOrder: Array<'forex' | 'metal' | 'crypto' | 'index'> = ['forex', 'metal', 'crypto', 'index']
  const categoryOrderMap: Record<string, number> = {
    forex: 0,
    metal: 1,
    crypto: 2,
    index: 3,
  }

  // Normalizar filas, tomando summary si es array; si no, shifts
  const shifts = rowsRaw.map((row, idx) => {
    const symbol = String(row?.symbol ?? "Activo")
    const bench = String(row?.benchmark ?? benchmark)
    const trend = typeof row?.trend === "string" && row.trend.length > 0 ? row.trend : null
    const label = trend ? `${symbol} vs ${bench} (${trend})` : `${symbol} vs ${bench}`
    const value =
      typeof row?.correlationNow === "number"
        ? row.correlationNow
        : typeof row?.value === "number"
        ? row.value
        : typeof row?.correlation === "number"
        ? row.correlation
        : undefined
    const absVal = typeof value === "number" ? Math.abs(value) : null
    const intensity =
      absVal == null
        ? "N/A"
        : absVal >= 0.6
        ? "Fuerte"
        : absVal >= 0.3
        ? "Moderada"
        : "Débil"
    const macroRel =
      typeof row?.macroRelevanceScore === "number"
        ? Math.max(0, Math.min(1, row.macroRelevanceScore))
        : null
    const relevancePct = macroRel != null ? Math.round(macroRel * 100) : null

    // Determinar categoría y moneda base para ordenamiento
    const category = getAssetCategorySafe(symbol)
    const baseCurrency = getBaseCurrency(symbol)

    return {
      key: row?.symbol ?? `row-${idx}`,
      symbol, // Guardar símbolo original para ordenamiento
      label,
      value,
      trend: trend ?? "Inconclusive",
      strongestWindow: row?.strongestWindow ?? null,
      corrWindow: row?.strongestWindow ?? row?.window ?? null,
      intensity,
      relevancePct,
      category,
      baseCurrency,
    }
  })

  // Ordenar igual que el dashboard: por categoría, luego por moneda base, luego alfabéticamente
  const rowsSorted = [...shifts].sort((a, b) => {
    // 1. Ordenar por categoría (forex, metal, crypto, index)
    const catA = categoryOrderMap[a.category] ?? 999
    const catB = categoryOrderMap[b.category] ?? 999
    if (catA !== catB) return catA - catB
    
    // 2. Para forex, ordenar por moneda base según currencyOrder
    if (a.category === 'forex' && b.category === 'forex') {
      const baseA = a.baseCurrency || 'OTHER'
      const baseB = b.baseCurrency || 'OTHER'
      
      const idxA = currencyOrder.indexOf(baseA)
      const idxB = currencyOrder.indexOf(baseB)
      
      // Si ambas están en el orden preferido, ordenar por índice
      if (idxA !== -1 && idxB !== -1) {
        if (idxA !== idxB) return idxA - idxB
      } else if (idxA !== -1) {
        return -1 // A está en el orden, B no
      } else if (idxB !== -1) {
        return 1 // B está en el orden, A no
      }
      // Si ninguna está en el orden preferido, ordenar alfabéticamente
      if (idxA === -1 && idxB === -1) {
        return baseA.localeCompare(baseB)
      }
    }
    
    // 3. Para otras categorías (metal, crypto, index), ordenar alfabéticamente por símbolo
    if (a.category !== 'forex' || b.category !== 'forex') {
      return (a.symbol || "").localeCompare(b.symbol || "")
    }
    
    // 4. Dentro del mismo grupo de moneda base en forex, ordenar alfabéticamente por símbolo
    return (a.symbol || "").localeCompare(b.symbol || "")
  })

  const rawWindows: any[] = Array.isArray(state?.windows) ? state.windows : []
  const windows = rawWindows.map((w, idx) => ({
    key: String(w?.label ?? w?.window ?? `win-${idx}`),
    label: String(w?.label ?? w?.window ?? "Ventana"),
  }))

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Correlaciones vs. {benchmark}</h1>
          <p className="text-sm text-muted-foreground">{summary}</p>
          <p className="text-xs text-muted-foreground">Actualizado: {updatedAtLabel}</p>
        </header>

        {/* Explicación de la página Correlaciones */}
        <CorrelationsIntroCard />

        {/* Bloque de "¿Cómo leer esta tabla?" */}
        <section>
          <details className="rounded-md border bg-muted/10 p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              ¿Cómo leer esta tabla de correlaciones?
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>
                Cada fila muestra la correlación actual entre uno de tus activos clave y el benchmark <span className="font-medium">{benchmark}</span>. Los valores van de -1 a +1:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">+1</span>: movimiento casi idéntico al benchmark.</li>
                <li><span className="font-medium">0</span>: sin relación estadística relevante.</li>
                <li><span className="font-medium">-1</span>: movimiento casi inverso al benchmark.</li>
              </ul>
              <p>
                La etiqueta entre paréntesis (Stable, Weak, Reinforcing…) resume la estabilidad de la correlación en las últimas ventanas (3–24m).
              </p>
              <p>
                Úsalo para decidir qué pares refuerzan tu exposición al {benchmark} y cuáles aportan cobertura o diversificación.
              </p>
            </div>
          </details>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-medium">Tabla de correlaciones</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Rango -1 (inversa) · 0 (sin relación) · +1 (directa)</span>
              <span className="hidden sm:inline">/ Ventana, tendencia, intensidad y relevancia macro</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Par vs {benchmark}</th>
                <th className="px-4 py-2 font-medium">Ventana corr.</th>
                <th className="px-4 py-2 font-medium">Ventana más fuerte</th>
                <th className="px-4 py-2 font-medium">Tendencia</th>
                <th className="px-4 py-2 font-medium">Intensidad</th>
                <th className="px-4 py-2 font-medium">Relevancia macro</th>
                <th className="px-4 py-2 text-right font-medium">Correlación actual</th>
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.corrWindow ? String(row.corrWindow) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.strongestWindow ? String(row.strongestWindow) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor:
                          row.trend === "Strengthening"
                            ? "rgba(16,185,129,0.6)"
                            : row.trend === "Weakening"
                            ? "rgba(248,113,113,0.6)"
                            : row.trend === "Stable"
                            ? "rgba(148,163,184,0.6)"
                            : "rgba(148,163,184,0.4)",
                        color:
                          row.trend === "Strengthening"
                            ? "rgb(16,185,129)"
                            : row.trend === "Weakening"
                            ? "rgb(248,113,113)"
                            : "rgb(148,163,184)",
                      }}
                    >
                      {row.trend}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor:
                          row.intensity === "Fuerte"
                            ? "rgba(16,185,129,0.6)"
                            : row.intensity === "Moderada"
                            ? "rgba(245,158,11,0.6)"
                            : "rgba(148,163,184,0.6)",
                        color:
                          row.intensity === "Fuerte"
                            ? "rgb(16,185,129)"
                            : row.intensity === "Moderada"
                            ? "rgb(245,158,11)"
                            : "rgb(148,163,184)",
                      }}
                    >
                      {row.intensity}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {typeof row.relevancePct === "number" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${row.relevancePct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {row.relevancePct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {typeof row.value === "number" ? row.value.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Ventanas de cálculo</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Las ventanas cortas (3–6m) capturan cambios recientes en la relación con el benchmark. Las ventanas largas (12–24m) muestran la estructura de fondo. Si la correlación cambia mucho entre ventanas, hay ruido de corto plazo que conviene tener en cuenta al dimensionar riesgo.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {windows.map((w) => (
              <li key={w.key} className="rounded-full border px-3 py-1">
                {w.label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
