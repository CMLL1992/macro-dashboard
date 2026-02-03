import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CurrencyScore {
  currency: string
  score: number // -3 a +3 (normalizado)
  status: 'Fuerte' | 'Neutro' | 'Débil'
  change?: number // Cambio desde período anterior (para tabs diario/semanal)
}

interface CurrencyScoreboardProps {
  currencies: CurrencyScore[]
  showChange?: boolean // Mostrar cambio Δ para tabs diario/semanal
}

export default function CurrencyScoreboard({ currencies = [], showChange = false }: CurrencyScoreboardProps) {
  // FIX: Validar que currencies sea array
  if (!Array.isArray(currencies)) {
    console.warn('[CurrencyScoreboard] currencies is not an array:', currencies)
    return null
  }

  const getStatusColor = (status: string) => {
    if (status === 'Fuerte') return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50'
    if (status === 'Débil') return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
    return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/50'
  }

  const getScoreColor = (score: number) => {
    // FIX: Score está en rango -3..+3, no 0..100
    // Umbrales ajustados: >= 1 (verde), >= 0 (amarillo), < 0 (rojo)
    if (score >= 1) return 'text-green-600 dark:text-green-400'
    if (score >= 0) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const formatScore = (score: number) => {
    // Score siempre en rango -3 a +3
    const clamped = Math.max(-3, Math.min(3, score))
    return clamped > 0 ? `+${clamped.toFixed(1)}` : clamped.toFixed(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fortaleza Macro por Moneda</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currencies.map((currency) => {
            // FIX: Validar estructura de currency antes de renderizar
            if (!currency || typeof currency.currency !== 'string' || typeof currency.score !== 'number') {
              console.warn('[CurrencyScoreboard] Invalid currency:', currency)
              return null
            }
            
            // FIX: Validar que score sea número válido
            if (!Number.isFinite(currency.score)) {
              console.warn('[CurrencyScoreboard] Invalid score for currency:', currency.currency, currency.score)
              return null
            }
            
            return (
              <div
                key={currency.currency}
                className="flex flex-col items-center p-4 rounded-lg border bg-muted/50 space-y-2"
              >
                <div className="text-lg font-semibold">{currency.currency}</div>
                <div className={`text-2xl font-bold ${getScoreColor(currency.score)}`}>
                  {formatScore(currency.score)}
                </div>
                <Badge className={getStatusColor(currency.status || 'Neutro')} variant="outline">
                  {currency.status || 'Neutro'}
                </Badge>
                {showChange && currency.change !== undefined && Number.isFinite(currency.change) && (
                  <div className={`text-xs ${currency.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency.change >= 0 ? '↑' : '↓'} {Math.abs(currency.change).toFixed(1)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
