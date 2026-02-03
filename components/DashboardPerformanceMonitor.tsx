'use client'

/**
 * Dashboard Performance Monitor
 * 
 * Componente invisible que monitorea el "First load budget" de /dashboard
 * Se ejecuta automáticamente al cargar la página
 */

import { useEffect } from 'react'
import { measureFirstLoadBudget } from '@/lib/client-performance'

export default function DashboardPerformanceMonitor() {
  useEffect(() => {
    // Medir "First load budget" después de que la página cargue
    measureFirstLoadBudget()
  }, [])

  // Este componente no renderiza nada (invisible)
  return null
}
