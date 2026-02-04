// Force dynamic rendering to avoid build-time DB access
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Caché en desarrollo: 30 segundos (mejora rendimiento sin perder frescura)
// En producción, usar revalidate más largo (ej: 300 segundos)
export const revalidate = process.env.NODE_ENV === 'development' ? 30 : 300

import MacroOverviewDashboard from '@/components/MacroOverviewDashboard'
import DashboardPerformanceMonitor from '@/components/DashboardPerformanceMonitor'
import MacroOverviewInfoPanel from '@/components/MacroOverviewInfoPanel'

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  void searchParams

  return (
    <main className="p-6">
      <DashboardPerformanceMonitor />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Macro Market Overview</p>
            <h1 className="text-3xl font-bold tracking-tight">Macro Market Overview</h1>
            <p className="text-sm text-muted-foreground">
              Visión consolidada del régimen macro y drivers clave
            </p>
          </div>
        </div>

        {/* Info Panel explicativo */}
        <MacroOverviewInfoPanel />

        {/* Macro Overview Dashboard con Tabs D/W/M */}
        {/* useOptimizedEndpoint=true: usa /api/overview con cache (más rápido) */}
        <MacroOverviewDashboard
          initialData={undefined} // No pasar data para forzar uso del endpoint optimizado
          useOptimizedEndpoint={true}
        />
      </div>
    </main>
  )
}
