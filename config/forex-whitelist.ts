/**
 * Forex Whitelist - Source of Truth
 * 
 * Only these 12 Forex pairs should appear in the dashboard.
 * Any pair outside this list must be filtered out and removed from the database.
 */

export const FOREX_WHITELIST = [
  // Majors
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  // Crosses
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "EURCHF",
  "AUDJPY",
] as const;

export type ForexWhitelistSymbol = typeof FOREX_WHITELIST[number];

/**
 * Check if a symbol is in the Forex whitelist
 */
export function isForexWhitelisted(symbol: string): boolean {
  const normalized = symbol.replace("/", "").toUpperCase();
  return (FOREX_WHITELIST as readonly string[]).includes(normalized);
}

/**
 * Convert symbol to display format (EUR/USD)
 */
export function toDisplayFormat(symbol: string): string {
  const normalized = symbol.replace("/", "").toUpperCase();
  if (normalized.length === 6) {
    return `${normalized.substring(0, 3)}/${normalized.substring(3, 6)}`;
  }
  return symbol;
}
