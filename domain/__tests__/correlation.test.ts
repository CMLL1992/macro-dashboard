import { describe, it, expect } from 'vitest'
import { pearson, rollingPearson } from '../correlation'

describe('correlation', () => {
  it('pearson basic', () => {
    const x = [1, 2, 3, 4, 5]
    const y = [2, 4, 6, 8, 10]
    const r = pearson(x, y)
    expect(r).not.toBeNull()
    if (r != null) expect(Math.abs(r)).toBeGreaterThan(0.99)
  })

  it('rollingPearson window', () => {
    const x = [1, 2, 3, 4, 5, 6]
    const y = [2, 3, 4, 5, 6, 7]
    const rs = rollingPearson(x, y, 3)
    expect(rs.length).toBe(4)
    expect(rs.every(v => v != null)).toBe(true)
  })
})


