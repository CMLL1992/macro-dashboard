/**
 * Metadatos para el overview multi-región (UI y contrato API).
 * Banderas y orden de grupos/divisas.
 */

export type OverviewGroup = 'inflation' | 'growth' | 'labor' | 'monetary' | 'sentiment'

export const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  USD: { flag: '🇺🇸', name: 'EEUU' },
  EUR: { flag: '🇪🇺', name: 'Eurozona' },
  GBP: { flag: '🇬🇧', name: 'Reino Unido' },
  JPY: { flag: '🇯🇵', name: 'Japón' },
  AUD: { flag: '🇦🇺', name: 'Australia' },
  CNY: { flag: '🇨🇳', name: 'China' },
  CNH: { flag: '🇨🇳', name: 'China' },
}

export const GROUP_ORDER: OverviewGroup[] = ['inflation', 'labor', 'monetary', 'growth', 'sentiment']

export const GROUP_LABEL: Record<string, string> = {
  inflation: 'Inflación',
  labor: 'Empleo',
  monetary: 'Tipos de interés',
  growth: 'Crecimiento',
  sentiment: 'Sentimiento',
}

export function getCurrencyFlag(currency: string): string {
  return CURRENCY_META[currency]?.flag ?? ''
}

export function getCurrencyName(currency: string): string {
  return CURRENCY_META[currency]?.name ?? currency
}
