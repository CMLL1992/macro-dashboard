/**
 * Demo page for macro data sources
 * Shows example cards for World Bank, IMF, and ECB data
 */

'use client'

import { useState, useEffect } from 'react'
import { useMacroSeries } from '@/lib/hooks/useMacroSeries'

export default function MacroDemoPage() {
  const wbUnemp = useMacroSeries('WORLD_BANK', {
    country: 'USA',
    indicator: 'SL.UEM.TOTL.ZS',
  })

  // Trade Balance is derived, so we need to fetch from derived endpoint
  const [tradeBalanceData, setTradeBalanceData] = useState<any>(undefined)
  const [tradeBalanceLoading, setTradeBalanceLoading] = useState(true)
  const [tradeBalanceError, setTradeBalanceError] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetch('/api/macro/derived?name=TRADE_BALANCE_USD&source=WORLD_BANK&country=USA')
      .then((res) => res.json())
      .then((data) => {
        setTradeBalanceData(data)
        setTradeBalanceLoading(false)
      })
      .catch((err) => {
        setTradeBalanceError(err.message)
        setTradeBalanceLoading(false)
      })
  }, [])

  const imfCPI = useMacroSeries('IMF', {
    flow: 'IFS',
    key: 'PCPIPCH.USA.A',
    freq: 'A',
  })

  const ecbEURUSD = useMacroSeries('ECB_SDW', {
    flow: 'EXR',
    key: 'D.USD.EUR.SP00.A',
    freq: 'D',
  })

  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Macro Data Sources Demo
        </h1>
        <p className="text-muted-foreground">
          Demostración de integración con World Bank, IMF y ECB
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {/* World Bank - Unemployment Rate */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">World Bank</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Unemployment Rate USA (Anual)
            </p>

            {wbUnemp.isLoading && (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            )}

            {wbUnemp.error && (
              <div className="text-sm text-red-600">Error: {wbUnemp.error}</div>
            )}

            {wbUnemp.data && (
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Serie:</strong> {wbUnemp.data.name}
                </div>
                <div className="text-sm">
                  <strong>ID:</strong> {wbUnemp.data.id}
                </div>
                <div className="text-sm">
                  <strong>Puntos:</strong> {wbUnemp.data.data.length}
                </div>
                {wbUnemp.data.data.length > 0 && (
                  <div className="text-sm">
                    <strong>Último valor:</strong>{' '}
                    {wbUnemp.data.data[wbUnemp.data.data.length - 1].value?.toFixed(
                      2
                    )}{' '}
                    % ({wbUnemp.data.data[wbUnemp.data.data.length - 1].date})
                  </div>
                )}
                {wbUnemp.data.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Actualizado: {wbUnemp.data.lastUpdated}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* IMF Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">IMF</h2>
            <p className="text-sm text-muted-foreground mb-4">
              CPI USA (Anual)
            </p>

            {imfCPI.isLoading && (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            )}

            {imfCPI.error && (
              <div className="text-sm text-red-600">Error: {imfCPI.error}</div>
            )}

            {imfCPI.data && (
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Serie:</strong> {imfCPI.data.name}
                </div>
                <div className="text-sm">
                  <strong>ID:</strong> {imfCPI.data.id}
                </div>
                <div className="text-sm">
                  <strong>Puntos:</strong> {imfCPI.data.data.length}
                </div>
                {imfCPI.data.data.length > 0 && (
                  <div className="text-sm">
                    <strong>Último valor:</strong>{' '}
                    {imfCPI.data.data[imfCPI.data.data.length - 1].value?.toFixed(
                      2
                    )}{' '}
                    ({imfCPI.data.data[imfCPI.data.data.length - 1].date})
                  </div>
                )}
                {imfCPI.data.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Actualizado: {imfCPI.data.lastUpdated}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ECB Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">ECB</h2>
            <p className="text-sm text-muted-foreground mb-4">
              EUR/USD (Diario)
            </p>

            {ecbEURUSD.isLoading && (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            )}

            {ecbEURUSD.error && (
              <div className="text-sm text-red-600">
                Error: {ecbEURUSD.error}
              </div>
            )}

            {ecbEURUSD.data && (
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Serie:</strong> {ecbEURUSD.data.name}
                </div>
                <div className="text-sm">
                  <strong>ID:</strong> {ecbEURUSD.data.id}
                </div>
                <div className="text-sm">
                  <strong>Puntos:</strong> {ecbEURUSD.data.data.length}
                </div>
                {ecbEURUSD.data.data.length > 0 && (
                  <div className="text-sm">
                    <strong>Último valor:</strong>{' '}
                    {ecbEURUSD.data.data[
                      ecbEURUSD.data.data.length - 1
                    ].value?.toFixed(4)}{' '}
                    (
                    {
                      ecbEURUSD.data.data[ecbEURUSD.data.data.length - 1].date
                    }
                    )
                  </div>
                )}
                {ecbEURUSD.data.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Actualizado: {ecbEURUSD.data.lastUpdated}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade Balance (Derived) */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">Trade Balance</h2>
            <p className="text-sm text-muted-foreground mb-4">
              USA (Derivado: Exports - Imports)
            </p>

            {tradeBalanceLoading && (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            )}

            {tradeBalanceError && (
              <div className="text-sm text-red-600">
                Error: {tradeBalanceError}
              </div>
            )}

            {tradeBalanceData && (
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Serie:</strong> {tradeBalanceData.name}
                </div>
                <div className="text-sm">
                  <strong>ID:</strong> {tradeBalanceData.id}
                </div>
                <div className="text-sm">
                  <strong>Puntos:</strong> {tradeBalanceData.data.length}
                </div>
                {tradeBalanceData.data.length > 0 && (
                  <div className="text-sm">
                    <strong>Último valor:</strong>{' '}
                    {(tradeBalanceData.data[tradeBalanceData.data.length - 1].value! / 1e9).toFixed(1)}{' '}
                    B USD ({tradeBalanceData.data[tradeBalanceData.data.length - 1].date})
                  </div>
                )}
                {tradeBalanceData.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Actualizado: {tradeBalanceData.lastUpdated}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PMI Proxy Notice */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-xl font-semibold mb-2 text-yellow-800">
            PMI Manufacturing
          </h2>
          <p className="text-sm text-yellow-700 mb-2">
            <strong>No disponible en fuentes gratuitas</strong>
          </p>
          <p className="text-sm text-yellow-700 mb-4">
            PMI es propiedad de S&P Global y requiere licencia. Usa{' '}
            <strong>Industrial Production Index (IPI)</strong> como proxy, disponible en IMF/ECB.
          </p>
          <div className="text-sm">
            <strong>Proxy recomendado:</strong> INDUSTRIAL_PRODUCTION_INDEX
          </div>
        </div>
      </div>
    </main>
  )
}

