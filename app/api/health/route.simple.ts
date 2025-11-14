/**
 * Health check endpoint - VERSIÓN SIMPLIFICADA PARA TESTING
 * Esta versión NO toca la base de datos para aislar el problema
 * 
 * INSTRUCCIONES:
 * 1. Renombra route.ts a route.ts.backup
 * 2. Renombra route.simple.ts a route.ts
 * 3. Prueba localmente: pnpm dev
 * 4. Prueba en producción: curl https://macro-dashboard-seven.vercel.app/api/health
 * 5. Si funciona, el problema está en la base de datos
 * 6. Si no funciona, el problema es más profundo (configuración de Vercel)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Respuesta fija sin tocar la base de datos
    return Response.json({
      status: 'ok',
      message: 'Health check simplificado - sin acceso a base de datos',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
      isVercel: !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL),
      test: {
        canAccessProcess: typeof process !== 'undefined',
        canAccessEnv: typeof process.env !== 'undefined',
        nodeVersion: process.version,
      },
    })
  } catch (error) {
    console.error('[api/health] Error en versión simplificada:', error)
    return Response.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

