import { LABELS } from '@/lib/fred'

export async function GET() {
  return Response.json(LABELS)
}


