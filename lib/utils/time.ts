/**
 * Time normalization utilities for different frequencies
 */

import type { Frequency } from '@/lib/types/macro'

/**
 * Normalize date string by frequency
 * @param input Date string (YYYY, YYYY-MM, YYYY-MM-DD, etc.)
 * @param freq Frequency code
 * @returns Normalized date string (YYYY-MM-DD)
 */
export function normalizeDateByFreq(input: string, freq: Frequency): string {
  const parts = input.split('-')
  const year = parseInt(parts[0] || '0', 10)

  switch (freq) {
    case 'A': // Annual -> YYYY-12-31
      return `${year}-12-31`

    case 'Q': // Quarterly -> first day of quarter
      {
        const month = parseInt(parts[1] || '1', 10)
        let quarterMonth = 1
        if (month >= 1 && month <= 3) quarterMonth = 1
        else if (month >= 4 && month <= 6) quarterMonth = 4
        else if (month >= 7 && month <= 9) quarterMonth = 7
        else quarterMonth = 10
        return `${year}-${String(quarterMonth).padStart(2, '0')}-01`
      }

    case 'M': // Monthly -> YYYY-MM-01
      {
        const month = parseInt(parts[1] || '1', 10)
        return `${year}-${String(month).padStart(2, '0')}-01`
      }

    case 'W': // Weekly -> keep day
    case 'D': // Daily -> keep day
      {
        const month = parts[1] || '01'
        const day = parts[2] || '01'
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }

    default:
      return input
  }
}

/**
 * Sort array by date in ascending order
 */
export function sortAscByDate<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.date.localeCompare(b.date))
}
