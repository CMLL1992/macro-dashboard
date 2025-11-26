/**
 * Unit tests for computePrevCurr and isStale functions
 */

import { describe, it, expect } from 'vitest'
import { computePrevCurr, isStale, getFrequency, type Observation } from '@/lib/macro/prev-curr'

describe('computePrevCurr', () => {
  it('current is last by date', () => {
    const { current } = computePrevCurr([
      { date: '2025-01-01', value: 1 },
      { date: '2025-02-01', value: 2 },
    ])
    expect(current?.value).toBe(2)
    expect(current?.date).toBe('2025-02-01')
  })

  it('previous has different date than current', () => {
    const { previous, current } = computePrevCurr([
      { date: '2025-02-01', value: 2 },
      { date: '2025-02-01', value: 2.1 }, // revisión misma fecha
      { date: '2025-01-01', value: 1 },
    ])
    expect(previous?.date).not.toBe(current?.date)
    expect(previous?.date).toBe('2025-01-01')
    expect(current?.date).toBe('2025-02-01')
    expect(current?.value).toBe(2.1) // Latest value for that date
  })

  it('handles single observation', () => {
    const { previous, current } = computePrevCurr([
      { date: '2025-01-01', value: 1 },
    ])
    expect(current?.value).toBe(1)
    expect(current?.date).toBe('2025-01-01')
    expect(previous).toBeNull()
  })

  it('handles empty array', () => {
    const { previous, current } = computePrevCurr([])
    expect(previous).toBeNull()
    expect(current).toBeNull()
  })

  it('filters out invalid values', () => {
    const { current } = computePrevCurr([
      { date: '2025-01-01', value: 1 },
      { date: '2025-02-01', value: NaN },
      { date: '2025-03-01', value: Infinity },
      { date: '2025-04-01', value: 4 },
    ])
    expect(current?.value).toBe(4)
    expect(current?.date).toBe('2025-04-01')
  })

  it('sorts by date correctly', () => {
    const { previous, current } = computePrevCurr([
      { date: '2025-03-01', value: 3 },
      { date: '2025-01-01', value: 1 },
      { date: '2025-02-01', value: 2 },
    ])
    expect(previous?.value).toBe(2)
    expect(current?.value).toBe(3)
  })

  it('handles multiple revisions of same date', () => {
    const { previous, current } = computePrevCurr([
      { date: '2025-01-01', value: 1 },
      { date: '2025-02-01', value: 2.0 },
      { date: '2025-02-01', value: 2.1 }, // revisión
      { date: '2025-02-01', value: 2.2 }, // otra revisión
    ])
    expect(current?.date).toBe('2025-02-01')
    expect(current?.value).toBe(2.2) // Latest revision
    expect(previous?.date).toBe('2025-01-01')
    expect(previous?.value).toBe(1)
  })
})

describe('isStale', () => {
  it('returns true for null date', () => {
    expect(isStale(null, 'monthly')).toBe(true)
  })

  it('returns false for recent daily data', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 2) // 2 days ago
    expect(isStale(recentDate.toISOString().split('T')[0], 'daily')).toBe(false)
  })

  it('returns true for old daily data', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10) // 10 days ago
    expect(isStale(oldDate.toISOString().split('T')[0], 'daily')).toBe(true)
  })

  it('returns false for recent monthly data', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 30) // 30 days ago
    expect(isStale(recentDate.toISOString().split('T')[0], 'monthly')).toBe(false)
  })

  it('returns true for old monthly data', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 60) // 60 days ago
    expect(isStale(oldDate.toISOString().split('T')[0], 'monthly')).toBe(true)
  })

  it('returns false for recent quarterly data', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 100) // 100 days ago
    expect(isStale(recentDate.toISOString().split('T')[0], 'quarterly')).toBe(false)
  })

  it('returns true for old quarterly data', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 150) // 150 days ago
    expect(isStale(oldDate.toISOString().split('T')[0], 'quarterly')).toBe(true)
  })

  it('handles frequency codes (d, w, m, q)', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    expect(isStale(oldDate.toISOString().split('T')[0], 'd')).toBe(true)
    expect(isStale(oldDate.toISOString().split('T')[0], 'm')).toBe(false)
  })

  it('defaults to 30 days for unknown frequency', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 20)
    expect(isStale(recentDate.toISOString().split('T')[0], 'unknown')).toBe(false)
    
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 40)
    expect(isStale(oldDate.toISOString().split('T')[0], 'unknown')).toBe(true)
  })
})

describe('getFrequency', () => {
  it('returns correct frequency for known values', () => {
    expect(getFrequency('daily')).toBe('daily')
    expect(getFrequency('weekly')).toBe('weekly')
    expect(getFrequency('monthly')).toBe('monthly')
    expect(getFrequency('quarterly')).toBe('quarterly')
  })

  it('maps frequency codes', () => {
    expect(getFrequency('d')).toBe('daily')
    expect(getFrequency('w')).toBe('weekly')
    expect(getFrequency('m')).toBe('monthly')
    expect(getFrequency('q')).toBe('quarterly')
  })

  it('defaults to monthly for unknown frequency', () => {
    expect(getFrequency('unknown')).toBe('monthly')
    expect(getFrequency(null)).toBe('monthly')
    expect(getFrequency(undefined)).toBe('monthly')
  })
})

