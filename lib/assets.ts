// Helper function to determine asset category from symbol
// Works on both client and server without requiring fs
export function getAssetCategory(symbol: string): 'forex' | 'crypto' | 'metal' | 'index' | null {
  const s = symbol.toUpperCase().replace('/', '')
  
  // Known indices
  const indices = ['SPX', 'NDX', 'DJI', 'RUT', 'VIX', 'DAX', 'FTSE', 'CAC', 'IBEX', 'N225', 'HSI', 'ASX']
  if (indices.includes(s)) return 'index'
  
  // Known metals (XAU, XAG, XPD, XPT)
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.startsWith('XPD') || s.startsWith('XPT')) return 'metal'
  
  // Known crypto (ends with USDT or common crypto symbols)
  if (s.endsWith('USDT') || s === 'BTCUSD' || ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'SHIB', 'TON', 'DOT', 'MATIC', 'LINK', 'BCH', 'NEAR', 'LTC', 'UNI', 'ATOM', 'APT', 'ARB', 'ALGO', 'FIL'].some(c => s.startsWith(c))) return 'crypto'
  
  // Forex pairs (typically 6 characters, or contains common forex currencies)
  const forexCurrencies = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'RUB', 'CNH', 'HKD', 'SGD', 'INR', 'BRL']
  if (s.length === 6 && forexCurrencies.some(c => s.includes(c))) return 'forex'
  if (forexCurrencies.some(c => s.includes(c) && s.length <= 8)) return 'forex'
  
  return null
}

// Comprehensive asset categories map (works on both client and server)
// This is a fallback for known assets
export const ASSET_CATEGORIES: Record<string, 'forex' | 'crypto' | 'metal' | 'index'> = {
    // Forex - Major pairs
    EURUSD: 'forex',
    GBPUSD: 'forex',
    AUDUSD: 'forex',
    USDJPY: 'forex',
    USDCAD: 'forex',
    NZDUSD: 'forex',
    USDCHF: 'forex',
    // Forex - Cross pairs
    EURJPY: 'forex',
    EURGBP: 'forex',
    EURCHF: 'forex',
    GBPJPY: 'forex',
    AUDJPY: 'forex',
    AUDNZD: 'forex',
    CADJPY: 'forex',
    CHFJPY: 'forex',
    EURAUD: 'forex',
    EURCAD: 'forex',
    EURNZD: 'forex',
    GBPAUD: 'forex',
    GBPCAD: 'forex',
    GBPCHF: 'forex',
    NZDJPY: 'forex',
    // Forex - Exotic
    USDMXN: 'forex',
    USDZAR: 'forex',
    USDSEK: 'forex',
    USDNOK: 'forex',
    USDDKK: 'forex',
    USDPLN: 'forex',
    USDTRY: 'forex',
    USDRUB: 'forex',
    USDCNH: 'forex',
    USDHKD: 'forex',
    USDSGD: 'forex',
    USDINR: 'forex',
    USDBRL: 'forex',
    // Crypto - Top 25
    BTCUSDT: 'crypto',
    ETHUSDT: 'crypto',
    BNBUSDT: 'crypto',
    SOLUSDT: 'crypto',
    XRPUSDT: 'crypto',
    ADAUSDT: 'crypto',
    DOGEUSDT: 'crypto',
    TRXUSDT: 'crypto',
    AVAXUSDT: 'crypto',
    SHIBUSDT: 'crypto',
    TONUSDT: 'crypto',
    DOTUSDT: 'crypto',
    MATICUSDT: 'crypto',
    LINKUSDT: 'crypto',
    BCHUSDT: 'crypto',
    NEARUSDT: 'crypto',
    LTCUSDT: 'crypto',
    UNIUSDT: 'crypto',
    ATOMUSDT: 'crypto',
    APTUSDT: 'crypto',
    ARBUSDT: 'crypto',
    ALGOUSDT: 'crypto',
    FILUSDT: 'crypto',
    BTCUSD: 'crypto',
    // Metals
    XAUUSD: 'metal',
    XAGUSD: 'metal',
    XPDUSD: 'metal',
    XPTUSD: 'metal',
    // Indices
    SPX: 'index',
    NDX: 'index',
    DJI: 'index',
    RUT: 'index',
    VIX: 'index',
    DAX: 'index',
    FTSE: 'index',
    CAC: 'index',
    IBEX: 'index',
    N225: 'index',
    HSI: 'index',
    ASX: 'index',
}

// Helper function that uses the map first, then the pattern matcher
export function getAssetCategorySafe(symbol: string): 'forex' | 'crypto' | 'metal' | 'index' {
  const s = symbol.toUpperCase().replace('/', '')
  return ASSET_CATEGORIES[s] || getAssetCategory(symbol) || 'forex' // Default to forex if unknown
}

