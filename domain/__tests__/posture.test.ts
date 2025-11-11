import { describe, it, expect } from 'vitest'
import { postureOf } from '../posture'

describe('posture rules extras', () => {
  it('USSLIND (LEI YoY)', () => {
    expect(postureOf('USSLIND', -0.1)).toBe('Dovish')
    expect(postureOf('USSLIND', 1.5)).toBe('Neutral')
    expect(postureOf('USSLIND', 3.0)).toBe('Hawkish')
  })

  it('U6RATE', () => {
    expect(postureOf('U6RATE', 9.0)).toBe('Dovish')
    expect(postureOf('U6RATE', 7.5)).toBe('Neutral')
    expect(postureOf('U6RATE', 6.8)).toBe('Hawkish')
  })
})


