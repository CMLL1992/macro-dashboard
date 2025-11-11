export function norm(sym: string): string {
  return sym.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function variants(sym: string): string[] {
  const raw = String(sym)
  const N = norm(raw)
  const n = N.toLowerCase()
  const withSlash = N.length === 6 ? `${N.slice(0, 3)}/${N.slice(3)}` : N
  const withSlashLower = withSlash.toLowerCase()
  return Array.from(new Set([raw, N, n, withSlash, withSlashLower]))
}


