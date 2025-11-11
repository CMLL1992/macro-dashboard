import { describe, it, expect } from 'vitest'
import { yoy, mom, sma, last } from '../fred'

describe('helpers', () => {
  const series = [
    { date: '2020-01-01', value: 100 },
    { date: '2020-02-01', value: 110 },
    { date: '2020-03-01', value: 120 },
    { date: '2021-01-01', value: 105 },
    { date: '2021-02-01', value: 121 },
  ]

  it('mom', () => {
    const m = mom(series)
    expect(m).toEqual([
      { date: '2020-02-01', value: 10 },
      { date: '2020-03-01', value: 10 },
      { date: '2021-01-01', value: -15 },
      { date: '2021-02-01', value: 16 },
    ])
  })

  it('sma n=3', () => {
    const s = sma(series, 3)
    expect(s).toEqual([
      { date: '2020-03-01', value: (100 + 110 + 120) / 3 },
      { date: '2021-01-01', value: (110 + 120 + 105) / 3 },
      { date: '2021-02-01', value: (120 + 105 + 121) / 3 },
    ])
  })

  it('yoy', () => {
    const y = yoy(series)
    // sólo compara cuando existe el dato 1 año antes
    // para 2021-01 y 2021-02
    const janYoY = ((105 - 100) / 100) * 100
    const febYoY = ((121 - 110) / 110) * 100
    expect(y).toEqual([
      { date: '2021-01-01', value: janYoY },
      { date: '2021-02-01', value: febYoY },
    ])
  })

  it('last', () => {
    const l = last(series)
    expect(l).toEqual({ date: '2021-02-01', value: 121 })
  })
})


