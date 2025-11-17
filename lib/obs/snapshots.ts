/**
 * In-memory snapshot history for dashboard renders
 */

type Snapshot = {
  page: string
  timestamp: string
  symbolSet: string[]
  biasHash?: string
  invariants: { pass: number; warn: number; fail: number }
  firstIssues?: Array<{ severity: 'PASS'|'WARN'|'FAIL'; code: string }>
}

const MAX = 100
const snapshots: Snapshot[] = []

export function pushSnapshot(s: Snapshot) {
  snapshots.unshift(s)
  if (snapshots.length > MAX) snapshots.pop()
  // Structured log
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ page: s.page, ts: s.timestamp, quality: s.invariants, hash: s.biasHash }))
}

export function getSnapshots(): Snapshot[] {
  return snapshots
}

