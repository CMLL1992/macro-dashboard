import { describe, it, expect } from 'vitest'
import { formatSignedTwoDecimals } from '@/lib/utils/format'

describe('Formateo estricto de correlaciones', () => {
  it('Siempre dos decimales y signo explícito', () => {
    expect(formatSignedTwoDecimals(0.423)).toBe('+0.42')
    expect(formatSignedTwoDecimals(-0.423)).toBe('-0.42')
    expect(formatSignedTwoDecimals(0)).toBe('+0.00')
  })

  it('Valores nulos o NaN devuelven \"—\"', () => {
    expect(formatSignedTwoDecimals(null as any)).toBe('—')
    expect(formatSignedTwoDecimals(undefined as any)).toBe('—')
    expect(formatSignedTwoDecimals(Number.NaN)).toBe('—')
  })
})


