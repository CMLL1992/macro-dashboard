import { LABELS } from '@/lib/fred'
import PairsSettingsClient from './PairsSettingsClient'
import fs from 'node:fs/promises'
import path from 'node:path'

export const metadata = { title: 'Configuración de Prioridades por Par' }
export const revalidate = 3600

export default async function PairsSettingsPage() {
  const configPath = path.join(process.cwd(), 'config', 'pair_event_priority.json')
  let data = {}
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    data = JSON.parse(raw)
  } catch {}
  return <PairsSettingsClient initialData={data} labels={LABELS} />
}

