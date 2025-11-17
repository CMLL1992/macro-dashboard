import { z } from 'zod'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const Schema = z.object({
  threshold: z.number().min(0).max(1),
  weights: z.record(z.string(), z.number().nonnegative()),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return Response.json({ ok: false, error: 'invalid' }, { status: 400 })
    const p = path.join(process.cwd(), 'config', 'weights.json')
    await fs.writeFile(p, JSON.stringify(parsed.data, null, 2), 'utf8')
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}


