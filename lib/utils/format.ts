export function formatSignedTwoDecimals(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const fixed = Number(value.toFixed(2))
  return fixed >= 0 ? `+${fixed.toFixed(2)}` : fixed.toFixed(2)
}


