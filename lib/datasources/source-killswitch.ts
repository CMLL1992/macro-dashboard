/**
 * Kill-switch for data sources
 * Allows disabling sources via environment variables for emergency situations
 */

export function isSourceEnabled(source: 'fred' | 'oecd' | 'trading_economics'): boolean {
  switch (source) {
    case 'fred':
      return process.env.DISABLE_FRED !== 'true'
    case 'oecd':
      return process.env.DISABLE_OECD !== 'true'
    case 'trading_economics':
      return process.env.DISABLE_TRADING_ECONOMICS !== 'true'
    default:
      return true
  }
}

export function getSourceDisabledReason(source: 'fred' | 'oecd' | 'trading_economics'): string | null {
  if (!isSourceEnabled(source)) {
    return `Source ${source.toUpperCase()} disabled via DISABLE_${source.toUpperCase()}=true`
  }
  return null
}
