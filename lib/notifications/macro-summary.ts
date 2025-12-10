/**
 * Resumen macroeconómico semanal
 * Incluye: régimen global, scores por moneda, escenarios activos, eventos recientes
 */

import { sendTelegramMessage } from './telegram'
import { getDashboardData } from '@/lib/dashboard-data'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Generar y enviar resumen macroeconómico semanal
 */
export async function sendWeeklyMacroSummary(): Promise<void> {
  try {
    const data = await getDashboardData()
    
    let message = '📊 *Resumen Macroeconómico Semanal*\n\n'
    message += `*${format(new Date(), 'EEEE dd/MM/yyyy', { locale: es })}*\n\n`
    
    // Régimen Global
    message += '🌍 *Régimen Global*\n'
    message += `   Régimen: *${data.regime.overall}*\n`
    message += `   USD: ${data.regime.usd_label} (${data.regime.usd_direction})\n`
    message += `   Quad: ${data.regime.quad}\n`
    message += `   Risk: ${data.regime.risk}\n`
    message += `   Liquidez: ${data.regime.liquidity}\n`
    message += `   Crédito: ${data.regime.credit}\n\n`
    
    // Scores por moneda
    if (data.currencyRegimes) {
      message += '💱 *Scores por Moneda*\n'
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD'] as const
      for (const currency of currencies) {
        const regime = data.currencyRegimes?.[currency]
        if (regime) {
          const emoji = regime.probability > 0.6 ? '🟢' : regime.probability > 0.4 ? '🟡' : '🔴'
          message += `   ${emoji} ${currency}: ${regime.regime} (${(regime.probability * 100).toFixed(0)}%)\n`
        }
      }
      message += '\n'
    }
    
    // Escenarios Activos
    if (data.scenariosActive && data.scenariosActive.length > 0) {
      message += '🎯 *Escenarios Activos (Alta Confianza)*\n'
      for (const scenario of data.scenariosActive.slice(0, 5)) {
        const confEmoji = scenario.confidence === 'Alta' ? '🟢' : '🟡'
        message += `   ${confEmoji} *${scenario.title}*\n`
        if (scenario.pair) message += `      Par: ${scenario.pair}\n`
        if (scenario.direction) message += `      Dirección: ${scenario.direction}\n`
        message += '\n'
      }
      if (data.scenariosActive.length > 5) {
        message += `   ... y ${data.scenariosActive.length - 5} más\n\n`
      }
    }
    
    // Escenarios Watchlist
    if (data.scenariosWatchlist && data.scenariosWatchlist.length > 0) {
      message += '👀 *Escenarios Watchlist (Media Confianza)*\n'
      for (const scenario of data.scenariosWatchlist.slice(0, 3)) {
        message += `   🟡 *${scenario.title}*\n`
        if (scenario.pair) message += `      Par: ${scenario.pair}\n`
        message += '\n'
      }
      if (data.scenariosWatchlist.length > 3) {
        message += `   ... y ${data.scenariosWatchlist.length - 3} más\n\n`
      }
    }
    
    // Eventos Recientes (últimos 7 días)
    if (data.recentEvents && data.recentEvents.length > 0) {
      message += '📈 *Eventos Recientes (Últimos 7 días)*\n'
      const recent = data.recentEvents.slice(0, 5)
      for (const event of recent) {
        const surpriseEmoji = event.surprise_direction === 'positive' ? '📈' : event.surprise_direction === 'negative' ? '📉' : '➡️'
        message += `   ${surpriseEmoji} *${event.name}* (${event.currency})\n`
        if (event.surprise_score != null) {
          message += `      Sorpresa: ${event.surprise_score.toFixed(2)}\n`
        }
        message += '\n'
      }
      if (data.recentEvents.length > 5) {
        message += `   ... y ${data.recentEvents.length - 5} más\n\n`
      }
    }
    
    // Indicadores Clave
    if (data.indicators && data.indicators.length > 0) {
      message += '📊 *Indicadores Clave*\n'
      const keyIndicators = data.indicators
        .filter(i => ['Inflación', 'Empleo', 'Crecimiento', 'Política Monetaria'].some(cat => i.category === cat))
        .slice(0, 6)
      
      for (const indicator of keyIndicators) {
        const trendEmoji = indicator.trend === 'Mejora' ? '📈' : indicator.trend === 'Empeora' ? '📉' : '➡️'
        message += `   ${trendEmoji} ${indicator.label}: ${indicator.value?.toFixed(2) ?? 'N/A'} ${indicator.unit ?? ''}\n`
        if (indicator.trend) {
          message += `      Tendencia: ${indicator.trend}\n`
        }
        message += '\n'
      }
    }
    
    message += `_Última actualización: ${data.updatedAt ? format(new Date(data.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}_`

    await sendTelegramMessage(message, { noParseMode: false })
  } catch (error) {
    console.error('[macro-summary] Error generating summary:', error)
    throw error
  }
}

