import { describe, it, expect } from 'vitest'
import { resampleToMonthly, alignByMonth, toClose } from '../index'

describe('markets parsers/helpers', () => {
  it('toClose & resampleToMonthly', () => {
    const series = [
      { date: '2024-01-01', open: 1, high: 2, low: 0.5, close: 1.5 },
      { date: '2024-01-31', open: 1.4, high: 2.1, low: 1.0, close: 2.0 },
      { date: '2024-02-29', open: 2.0, high: 2.2, low: 1.8, close: 2.1 },
    ] as any
    const c = toClose(series)
    expect(c).toEqual([
      { date: '2024-01-01', value: 1.5 },
      { date: '2024-01-31', value: 2.0 },
      { date: '2024-02-29', value: 2.1 },
    ])
    const m = resampleToMonthly(c)
    expect(m).toEqual([
      { date: '2024-01-31', value: 2.0 },
      { date: '2024-02-29', value: 2.1 },
    ])
  })

  it('alignByMonth', () => {
    const a = [
      { date: '2024-01-31', value: 100 },
      { date: '2024-02-29', value: 110 },
      { date: '2024-03-31', value: 120 },
    ]
    const b = [
      { date: '2024-02-15', value: 200 },
      { date: '2024-03-31', value: 220 },
    ]
    const { x, y } = alignByMonth(a, b)
    expect(x).toEqual([110, 120])
    expect(y).toEqual([200, 220])
  })
})


