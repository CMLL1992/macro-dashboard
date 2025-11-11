import { describe, it, expect } from 'vitest'
import { firstFridayOfMonth, lastBusinessDayOfMonth, lastTuesdayOfMonth, toISO } from '../schedule'

describe('schedule rules', () => {
  it('firstFridayOfMonth (NFP)', () => {
    const d = firstFridayOfMonth(2025, 0) // Jan 2025
    expect(d.getDay()).toBe(5)
  })

  it('lastBusinessDayOfMonth (PCE)', () => {
    const d = lastBusinessDayOfMonth(2025, 4) // May 2025
    expect(toISO(d).slice(0,7)).toBe('2025-05')
  })

  it('lastTuesdayOfMonth (CB Consumer Confidence)', () => {
    const d = lastTuesdayOfMonth(2025, 6) // Jul 2025
    expect(d.getDay()).toBe(2)
  })
})


