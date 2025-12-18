/**
 * Configuración de países/regiones para el calendario económico
 * Mapeo de países a códigos de región y monedas
 */

export type RegionCode = 'US' | 'EU' | 'UK' | 'JP' | 'AU' | 'CA' | 'CH' | 'CN' | 'DE' | 'FR' | 'IT' | 'ES' | 'NZ'

export interface CountryConfig {
  name: string
  region: RegionCode
  currency: string
  priority: number // Prioridad para mostrar (menor = más importante)
}

/**
 * Mapeo de países a configuración
 */
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'United States': { name: 'United States', region: 'US', currency: 'USD', priority: 1 },
  'USA': { name: 'United States', region: 'US', currency: 'USD', priority: 1 },
  'US': { name: 'United States', region: 'US', currency: 'USD', priority: 1 },
  
  'Euro Area': { name: 'Euro Area', region: 'EU', currency: 'EUR', priority: 2 },
  'Eurozone': { name: 'Euro Area', region: 'EU', currency: 'EUR', priority: 2 },
  'European Union': { name: 'Euro Area', region: 'EU', currency: 'EUR', priority: 2 },
  'Germany': { name: 'Germany', region: 'DE', currency: 'EUR', priority: 3 },
  'France': { name: 'France', region: 'FR', currency: 'EUR', priority: 4 },
  'Italy': { name: 'Italy', region: 'IT', currency: 'EUR', priority: 5 },
  'Spain': { name: 'Spain', region: 'ES', currency: 'EUR', priority: 6 },
  
  'United Kingdom': { name: 'United Kingdom', region: 'UK', currency: 'GBP', priority: 2 },
  'UK': { name: 'United Kingdom', region: 'UK', currency: 'GBP', priority: 2 },
  
  'Japan': { name: 'Japan', region: 'JP', currency: 'JPY', priority: 2 },
  'JP': { name: 'Japan', region: 'JP', currency: 'JPY', priority: 2 },
  
  'Australia': { name: 'Australia', region: 'AU', currency: 'AUD', priority: 2 },
  'AU': { name: 'Australia', region: 'AU', currency: 'AUD', priority: 2 },
  
  'Canada': { name: 'Canada', region: 'CA', currency: 'CAD', priority: 3 },
  'CA': { name: 'Canada', region: 'CA', currency: 'CAD', priority: 3 },
  
  'Switzerland': { name: 'Switzerland', region: 'CH', currency: 'CHF', priority: 3 },
  'CH': { name: 'Switzerland', region: 'CH', currency: 'CHF', priority: 3 },
  
  'China': { name: 'China', region: 'CN', currency: 'CNY', priority: 3 },
  'CN': { name: 'China', region: 'CN', currency: 'CNY', priority: 3 },
  
  'New Zealand': { name: 'New Zealand', region: 'NZ', currency: 'NZD', priority: 4 },
  'NZ': { name: 'New Zealand', region: 'NZ', currency: 'NZD', priority: 4 },
}

/**
 * Obtener configuración de país por nombre
 */
export function getCountryConfig(country: string): CountryConfig | null {
  const normalized = country.trim()
  return COUNTRY_CONFIG[normalized] || COUNTRY_CONFIG[normalized.toUpperCase()] || null
}

/**
 * Obtener código de región por país
 */
export function getRegionCode(country: string): RegionCode | null {
  const config = getCountryConfig(country)
  return config?.region || null
}

/**
 * Lista de regiones principales para filtros
 */
export const MAIN_REGIONS: RegionCode[] = ['US', 'EU', 'UK', 'JP', 'AU', 'CA', 'CH', 'CN']

/**
 * Nombres legibles de regiones
 */
export const REGION_NAMES: Record<RegionCode, string> = {
  US: 'Estados Unidos',
  EU: 'Eurozona',
  UK: 'Reino Unido',
  JP: 'Japón',
  AU: 'Australia',
  CA: 'Canadá',
  CH: 'Suiza',
  CN: 'China',
  DE: 'Alemania',
  FR: 'Francia',
  IT: 'Italia',
  ES: 'España',
  NZ: 'Nueva Zelanda',
}











