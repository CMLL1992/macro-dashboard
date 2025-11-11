/**
 * Canonical macro indicator catalog
 * Maps canonical indicator keys to source-specific parameters
 */

import type { WorldBankParams } from '@/lib/datasources/worldbank'
import type { IMFParams } from '@/lib/datasources/imf'
import type { ECBParams } from '@/lib/datasources/ecb'

export type CatalogIndicator =
  | 'CPI_YOY'
  | 'GDP_REAL'
  | 'UNEMP_RATE'
  | 'RETAIL_SALES'
  | 'CURRENT_ACCOUNT'
  | 'CURRENT_ACCOUNT_PCT_GDP'
  | 'CURRENT_ACCOUNT_USD'
  | 'EXPORTS_GS_USD'
  | 'IMPORTS_GS_USD'
  | 'TRADE_BALANCE'
  | 'TRADE_BALANCE_USD'
  | 'PMI_MANUF'
  | 'INDUSTRIAL_PRODUCTION_INDEX'

export type CatalogSource = 'WORLD_BANK' | 'IMF' | 'ECB_SDW'

export type CatalogParams =
  | WorldBankParams
  | IMFParams
  | ECBParams

export type AvailabilityStatus =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE_FREE_SOURCE'
  | 'REQUIRES_DERIVATION'

export interface AvailabilityInfo {
  status: AvailabilityStatus
  proxy?: string
  note?: string
}

export interface CatalogEntry {
  WORLD_BANK?: (iso3: string) => WorldBankParams
  IMF?: (iso3: string) => IMFParams
  ECB_SDW?: () => ECBParams
  availability?: {
    WORLD_BANK?: AvailabilityInfo
    IMF?: AvailabilityInfo
    ECB_SDW?: AvailabilityInfo
  }
  derivation?: {
    formula: 'SUB' | 'ADD' | 'DIV' | 'MUL'
    sources: Array<{ source: CatalogSource; indicator: CatalogIndicator }>
  }
}

export const MacroCatalog: Record<CatalogIndicator, CatalogEntry> = {
  CPI_YOY: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'FP.CPI.TOTL.ZG',
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `PCPIPCH.${iso3}.A`,
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'ICP',
      key: 'M.I10.CP0000.IX2015.A',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  GDP_REAL: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'NY.GDP.MKTP.KD',
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `NGDP_R_${iso3}.A`,
      freq: 'A',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
    },
  },
  UNEMP_RATE: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'SL.UEM.TOTL.ZS',
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `LUR.${iso3}.M`, // Dynamic resolution will find the correct key
      freq: 'M',
    }),
    ECB_SDW: () => ({
      flow: 'UNE',
      key: 'M.US.TOTAL.SA', // Dynamic resolution will find the correct key
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  RETAIL_SALES: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: '', // Not available in WDI
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `SLRTTO01.${iso3}.M`, // Dynamic resolution
      freq: 'M',
    }),
    ECB_SDW: () => ({
      flow: 'STS',
      key: 'M.S.I8.Y.RT0000.4.INX', // Dynamic resolution for EA retail trade volume
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: {
        status: 'NOT_AVAILABLE_FREE_SOURCE',
        note: 'Retail sales not available in World Bank WDI',
      },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  CURRENT_ACCOUNT_USD: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'BN.CAB.XOKA.CD',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BCA.${iso3}.USD`, // Dynamic resolution
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.CA', // Dynamic resolution for EA
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  CURRENT_ACCOUNT_PCT_GDP: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'BN.CAB.XOKA.GD.ZS',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BCA.${iso3}.PCT_GDP`, // Dynamic resolution or derivation
      freq: 'A',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'REQUIRES_DERIVATION' },
    },
    derivation: {
      formula: 'DIV',
      sources: [
        { source: 'WORLD_BANK', indicator: 'CURRENT_ACCOUNT_USD' },
        { source: 'WORLD_BANK', indicator: 'GDP_REAL' },
      ],
    },
  },
  CURRENT_ACCOUNT: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'BN.CAB.XOKA.CD',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BCA.${iso3}.USD`,
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.CA',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  EXPORTS_GS_USD: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'NE.EXP.GNFS.CD',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BX.${iso3}.USD`,
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.EX',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  IMPORTS_GS_USD: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'NE.IMP.GNFS.CD',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BM.${iso3}.USD`,
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.IM',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'AVAILABLE' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
  TRADE_BALANCE_USD: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: '', // Derived
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BT.${iso3}.USD`, // May exist directly, otherwise derived
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.TB',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'REQUIRES_DERIVATION' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
    derivation: {
      formula: 'SUB',
      sources: [
        { source: 'WORLD_BANK', indicator: 'EXPORTS_GS_USD' },
        { source: 'WORLD_BANK', indicator: 'IMPORTS_GS_USD' },
      ],
    },
  },
  TRADE_BALANCE: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: '',
    }),
    IMF: (iso3: string) => ({
      flow: 'BOP',
      key: `BT.${iso3}.USD`,
      freq: 'A',
    }),
    ECB_SDW: () => ({
      flow: 'BOP',
      key: 'M.EA.BP6.TB',
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: { status: 'REQUIRES_DERIVATION' },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
    derivation: {
      formula: 'SUB',
      sources: [
        { source: 'WORLD_BANK', indicator: 'EXPORTS_GS_USD' },
        { source: 'WORLD_BANK', indicator: 'IMPORTS_GS_USD' },
      ],
    },
  },
  PMI_MANUF: {
    availability: {
      WORLD_BANK: {
        status: 'NOT_AVAILABLE_FREE_SOURCE',
        proxy: 'INDUSTRIAL_PRODUCTION_INDEX',
        note: 'PMI is proprietary (S&P Global). Use IPI proxy.',
      },
      IMF: {
        status: 'NOT_AVAILABLE_FREE_SOURCE',
        proxy: 'INDUSTRIAL_PRODUCTION_INDEX',
        note: 'PMI is proprietary (S&P Global). Use IPI proxy.',
      },
      ECB_SDW: {
        status: 'NOT_AVAILABLE_FREE_SOURCE',
        proxy: 'INDUSTRIAL_PRODUCTION_INDEX',
        note: 'PMI is proprietary (S&P Global). Use IPI proxy.',
      },
    },
  },
  INDUSTRIAL_PRODUCTION_INDEX: {
    WORLD_BANK: (iso3: string) => ({
      countryISO3: iso3,
      indicatorCode: 'IP.INDX', // Not in WDI, placeholder
    }),
    IMF: (iso3: string) => ({
      flow: 'IFS',
      key: `IP.${iso3}.M`, // Dynamic resolution
      freq: 'M',
    }),
    ECB_SDW: () => ({
      flow: 'STS',
      key: 'M.S.I8.Y.PROD.NS0010.4.000', // Dynamic resolution for EA industrial production
      freq: 'M',
    }),
    availability: {
      WORLD_BANK: {
        status: 'NOT_AVAILABLE_FREE_SOURCE',
        note: 'Industrial production index not available in World Bank WDI',
      },
      IMF: { status: 'AVAILABLE' },
      ECB_SDW: { status: 'AVAILABLE' },
    },
  },
}

/**
 * Get parameters for a canonical indicator from a specific source
 */
export function getCatalogParams(
  indicator: CatalogIndicator,
  source: CatalogSource,
  countryISO3?: string
): CatalogParams | null {
  const entry = MacroCatalog[indicator]
  const sourceFn = entry[source]

  if (!sourceFn) {
    return null
  }

  if (source === 'ECB_SDW') {
    return (sourceFn as () => ECBParams)()
  }

  if (!countryISO3) {
    throw new Error(`Country ISO3 required for ${source} source`)
  }

  return (sourceFn as (iso3: string) => WorldBankParams | IMFParams)(
    countryISO3
  )
}

/**
 * Get availability information for an indicator from a source
 */
export function getAvailability(
  indicator: CatalogIndicator,
  source: CatalogSource
): AvailabilityInfo | null {
  const entry = MacroCatalog[indicator]
  return entry.availability?.[source] || null
}

/**
 * Get derivation specification if indicator requires computation
 */
export function getDerivation(
  indicator: CatalogIndicator
): CatalogEntry['derivation'] {
  const entry = MacroCatalog[indicator]
  return entry.derivation
}
