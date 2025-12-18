/**
 * Debug endpoint to check environment variables
 * TEMPORARY - Remove after verification
 */

export const runtime = "nodejs"

export async function GET() {
  return Response.json({
    has_TE_API_KEY: Boolean(process.env.TE_API_KEY),
    has_VERCEL: Boolean(process.env.VERCEL),
    has_VERCEL_ENV: Boolean(process.env.VERCEL_ENV),
    vercel_env_value: process.env.VERCEL_ENV ?? null,
    has_NODE_ENV: Boolean(process.env.NODE_ENV),
    node_env_value: process.env.NODE_ENV ?? null,
    dummy: process.env.DUMMY_ENV_TEST ?? null,
  })
}
