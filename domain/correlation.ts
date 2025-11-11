export function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length)
  if (n < 3) return null
  const sx = x.slice(-n), sy = y.slice(-n)
  const mx = sx.reduce((a, b) => a + b, 0) / n, my = sy.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { const ax = sx[i] - mx, ay = sy[i] - my; num += ax * ay; dx += ax * ax; dy += ay * ay }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : +((num / den).toFixed(2))
}

export function rollingPearson(x: number[], y: number[], win = 12): number[] {
  const out: number[] = []
  for (let i = win; i <= Math.min(x.length, y.length); i++) {
    const r = pearson(x.slice(i - win, i), y.slice(i - win, i))
    if (r != null) out.push(r)
  }
  return out
}


