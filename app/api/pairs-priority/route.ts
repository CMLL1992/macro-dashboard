import { NextRequest } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const configPath = path.join(process.cwd(), 'config', 'pair_event_priority.json')

const schema = z.record(z.string(), z.array(z.string()))

export async function GET() {
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    const data = JSON.parse(raw)
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = schema.parse(body)
    await fs.writeFile(configPath, JSON.stringify(validated, null, 2), 'utf8')
    return Response.json({ ok: true })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: 'Invalid format', details: e.errors }, { status: 400 })
    }
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

