/**
 * Debug endpoint to check environment variables
 * TEMPORARY - Remove after verification
 */

export const runtime = "nodejs"

export async function GET() {
  return Response.json({
    TE_API_KEY: { configured: (process.env.TE_API_KEY?.length ?? 0) > 0 }
  })
}
