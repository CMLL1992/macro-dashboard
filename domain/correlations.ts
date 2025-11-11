import fs from 'node:fs/promises'

export type CorrelationEntry = {
  pair: string
  ref: string // referencia (ej: DXY, SPX, GOLD, BTC)
  corr12m: number | null
  corr6m: number | null
  corr3m: number | null
  lastUpdated: string
}

const DATA_PATH = 'data/correlations.json'

export async function loadCorrelations(): Promise<CorrelationEntry[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function saveCorrelations(data: CorrelationEntry[]) {
  await fs.mkdir('data', { recursive: true })
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function getCorrelationFor(pair: string): Promise<CorrelationEntry | null> {
  const all = await loadCorrelations()
  const found = all.find(c => c.pair.toUpperCase() === pair.toUpperCase())
  return found ?? null
}


