/**
 * Constantes centralizadas para el calendario macroeconómico
 * 
 * Estas constantes se usan en:
 * - Job de ingesta (/api/jobs/ingest/calendar)
 * - API de calendario (/api/calendar)
 * - Whitelist de eventos (calendar-whitelist.ts)
 * - UI del calendario
 */

/**
 * Países permitidos en el calendario (solo estos 5)
 */
export const ALLOWED_COUNTRIES = [
  'United States',
  'Euro Area',
  'Spain',
  'United Kingdom',
  'Germany',
] as const

/**
 * Tipo TypeScript para países permitidos
 */
export type AllowedCountry = (typeof ALLOWED_COUNTRIES)[number]

/**
 * Mapeo de países a códigos de región/moneda
 */
export const COUNTRY_TO_REGION: Record<AllowedCountry, { region: string; currency: 'USD' | 'EUR' | 'GBP' }> = {
  'United States': { region: 'US', currency: 'USD' },
  'Euro Area': { region: 'EU', currency: 'EUR' },
  'Spain': { region: 'ES', currency: 'EUR' },
  'United Kingdom': { region: 'UK', currency: 'GBP' },
  'Germany': { region: 'DE', currency: 'EUR' },
}

/**
 * Verifica si un país está en la lista permitida
 */
export function isAllowedCountry(country: string): country is AllowedCountry {
  return ALLOWED_COUNTRIES.includes(country as AllowedCountry)
}
