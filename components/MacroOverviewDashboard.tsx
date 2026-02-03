'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import MacroOverviewTabs, { type TimeHorizon } from './MacroOverviewTabs'
import RegimeGlobalCard from './RegimeGlobalCard'
import CurrencyScoreboard from './CurrencyScoreboard'
import MacroEventsPanel from './MacroEventsPanel'
import type { DashboardData } from '@/lib/dashboard-data'
import { getOverviewCache } from '@/lib/cache/overview-cache'
import type { ProcessedIndicator } from '@/lib/dashboard-time-horizon'
import { safeArray, isRecord } from '@/lib/utils/guards'
import type { CoreIndicator } from './CoreIndicatorsTable'

// OPTIMIZATION: Dynamic import de componentes pesados que no están "above the fold"
// CoreIndicatorsTable se carga solo cuando se necesita (tab activo)
// Esto reduce el bundle inicial del dashboard
const CoreIndicatorsTable = dynamic(() => import('./CoreIndicatorsTable'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-muted h-64 rounded-lg" />,
})

// OPTIMIZATION: Las funciones de procesamiento solo se usan en fallback SSR
// Con useOptimizedEndpoint=true (default), los datos vienen del endpoint ya procesados
// Por lo tanto, no necesitamos cargar estas funciones en el bundle inicial

interface MacroOverviewDashboardProps {
  initialData?: DashboardData // Optional: can use endpoint instead
  currencyRegimes?: {
    USD?: { regime: string; probability: number; description: string }
    EUR?: { regime: string; probability: number; description: string }
    GBP?: { regime: string; probability: number; description: string }
    JPY?: { regime: string; probability: number; description: string }
    AUD?: { regime: string; probability: number; description: string }
  }
  useOptimizedEndpoint?: boolean // Feature flag: use /api/overview instead of SSR
}

interface OverviewData {
  regimeGlobal: {
    risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
    usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
    growthTrend: 'acelerando' | 'desacelerando' | 'estable'
    inflationTrend: 'acelerando' | 'desacelerando' | 'estable'
    confidence: 'Alta' | 'Media' | 'Baja'
    confidenceExplanation: string
    topDrivers: Array<{ key: string; label: string; reason: string }>
  }
  currencyScoreboard: Array<{
    currency: string
    score: number
    status: 'Fuerte' | 'Neutro' | 'Débil'
  }>
  coreIndicators: CoreIndicator[]
  performance?: {
    totalMs: number
    queriesMs: number
    processingMs: number
  }
}

// Regla obligatoria en UI: solo majors
const ALLOWED_CURRENCIES_UI = new Set(['USD', 'EUR', 'GBP', 'JPY'])

type CurrencyScoreLocal = {
  currency: string
  score: number
  status: 'Fuerte' | 'Neutro' | 'Débil'
  change?: number
}

export default function MacroOverviewDashboard({ 
  initialData, 
  currencyRegimes,
  useOptimizedEndpoint = true // Default: use optimized endpoint
}: MacroOverviewDashboardProps) {
  const [activeTab, setActiveTab] = useState<TimeHorizon>('daily')
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch from optimized endpoint when tab changes
  useEffect(() => {
    if (!useOptimizedEndpoint || initialData) {
      // Use SSR data if provided or if endpoint is disabled
      return
    }

    const fetchOverview = async () => {
      setLoading(true)
      setError(null)
      try {
        const tf = activeTab === 'weekly' ? 'w' : activeTab === 'monthly' ? 'm' : 'd'
        
        // OPTIMIZATION: Reutilizar cache del prefetch si está disponible
        const cachedData = getOverviewCache(tf)
        if (cachedData) {
          setOverviewData(cachedData)
          setLoading(false)
          return
        }
        
        // Si no hay cache in-memory, hacer fetch normal
        // Usar 'default' para aprovechar HTTP cache del navegador (Cache-Control del endpoint)
        // Esto complementa el cache in-memory: si se recarga la página, el navegador puede reutilizar
        const response = await fetch(`/api/overview?tf=${tf}`, {
          cache: 'default', // Usar HTTP cache del navegador (complementa cache in-memory)
        })
        
        if (!response.ok) {
          let errorData: any = {}
          try {
            errorData = await response.json()
          } catch {
            errorData = { error: response.statusText }
          }
          const errorMessage = `Failed to fetch overview: ${response.status} ${response.statusText}${errorData.details ? ` - ${errorData.details}` : ''}${errorData.requestId ? ` (requestId: ${errorData.requestId})` : ''}`
          throw new Error(errorMessage)
        }
        
        const data: OverviewData = await response.json()
        setOverviewData(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load overview'
        setError(errorMessage)
        console.error('[MacroOverviewDashboard] Error fetching overview:', {
          error: err,
          activeTab,
          url: `/api/overview?tf=${activeTab === 'weekly' ? 'w' : activeTab === 'monthly' ? 'm' : 'd'}`,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [activeTab, useOptimizedEndpoint, initialData])

  // Use endpoint data if available, otherwise fallback to SSR data
  const useEndpointData = useOptimizedEndpoint && overviewData && !initialData

  // Procesar indicadores según el horizonte temporal activo
  const processedIndicators = useMemo(() => {
    if (useEndpointData && overviewData) {
      // FIX 1.2A: Validar array antes de map
      const core = safeArray(overviewData?.coreIndicators)
      // Convert endpoint indicators to ProcessedIndicator format
      return core.map((ind: any) => ({
        key: ind.key,
        label: ind.label,
        category: ind.category,
        value: ind.value,
        previous: ind.previous,
        date: ind.date,
        trend: ind.trend === 'acelera' ? 'Mejora' : ind.trend === 'desacelera' ? 'Empeora' : null,
        weight: ind.importance === 'Alta' ? 0.08 : ind.importance === 'Media' ? 0.04 : 0.02,
        unit: ind.unit,
        change: ind.change,
        surprise: ind.surprise,
        weeklyMomentum: ind.weeklyMomentum,
        hasNewPublication: ind.hasNewPublication,
        monthlyTrend: ind.monthlyTrend,
        posture: null, // Campo requerido por ProcessedIndicator
      } as ProcessedIndicator))
    }
    if (!initialData) return []
    // OPTIMIZATION: Con useOptimizedEndpoint=true (default), initialData normalmente es undefined
    // Si se proporciona initialData (fallback SSR), retornar indicadores básicos sin procesamiento pesado
    // El procesamiento pesado se hace en el servidor (endpoint)
    return (initialData.indicators || []).map(ind => ({
      key: ind.key,
      label: ind.label,
      category: 'Crecimiento' as const,
      value: ind.value,
      previous: ind.previous,
      date: ind.date,
      trend: ind.trend === 'Mejora' ? 'Mejora' : ind.trend === 'Empeora' ? 'Empeora' : null,
      weight: ind.weight || 0,
      unit: ind.unit,
      posture: ind.posture,
    } as ProcessedIndicator))
  }, [useEndpointData, overviewData, initialData, activeTab])

  // Convertir indicadores procesados a formato CoreIndicator (TODOS los permitidos, sin límite)
  const coreIndicators: CoreIndicator[] = useMemo(() => {
    // If using endpoint data, return it directly (already in CoreIndicator format)
    if (useEndpointData && overviewData) {
      return overviewData.coreIndicators
    }
    
    return processedIndicators.map((ind) => {
      // Determinar categoría
      let category: CoreIndicator['category'] = 'Crecimiento'
      const key = ind.key.toUpperCase()
      
      // Empleo: NFP, desempleo, salarios, peticiones, participación
      if (key.includes('PAYEMS') || key.includes('NFP') || key.includes('UNRATE') || 
          key.includes('JOLTS') || key.includes('CLAIMS') || key.includes('CIVPART') ||
          key.includes('PARTICIPATION') || key.includes('AHETPI') || key.includes('EARNINGS')) {
        category = 'Empleo'
      } 
      // Inflación: CPI, PPI, PCE, costes laborales, expectativas
      else if (key.includes('CPI') || key.includes('PCE') || key.includes('PPI') ||
               key.includes('ECICOST') || key.includes('ULCTOT') || key.includes('LABOR_COST') ||
               key.includes('INFLATION_EXPECTATIONS') || key.includes('T5YIFR') || key.includes('T10YIE') ||
               key.includes('MICH') || key.includes('BREAKEVEN')) {
        category = 'Inflación'
      } 
      // Tipos: decisiones BC, actas, discursos, futuros, diferenciales
      else if (key.includes('FEDFUNDS') || key.includes('T10Y') || key.includes('RATE') ||
               key.includes('ECB_RATE') || key.includes('BOE_RATE') || key.includes('BOJ_RATE') ||
               key.includes('SPREAD') || key.includes('SOFR') || key.includes('ESTR') ||
               key.includes('YIELD') || key.includes('CURVE')) {
        category = 'Tipos/Condiciones'
      }

      // Determinar tendencia según horizonte temporal
      let trend: CoreIndicator['trend'] = 'estable'
      if (activeTab === 'monthly' && ind.monthlyTrend) {
        // Mapear 'acelerando' -> 'acelera', 'desacelerando' -> 'desacelera'
        if (ind.monthlyTrend === 'acelerando') trend = 'acelera'
        else if (ind.monthlyTrend === 'desacelerando') trend = 'desacelera'
        else trend = 'estable'
      } else if (ind.trend === 'Mejora') {
        trend = 'acelera'
      } else if (ind.trend === 'Empeora') {
        trend = 'desacelera'
      }

      // Determinar importancia basada en peso
      let importance: CoreIndicator['importance'] = 'Baja'
      const weight = ind.weight || 0
      if (weight >= 0.08) importance = 'Alta'
      else if (weight >= 0.04) importance = 'Media'

      return {
        key: ind.key,
        label: ind.label,
        category,
        value: ind.value,
        previous: ind.previous,
        date: ind.date,
        trend,
        importance,
        unit: ind.unit || undefined,
        // Campos adicionales según horizonte temporal
        change: ind.change,
        surprise: ind.surprise,
        weeklyMomentum: ind.weeklyMomentum,
        hasNewPublication: ind.hasNewPublication,
        monthlyTrend: ind.monthlyTrend,
      }
    })
  }, [processedIndicators, activeTab])

  // Convertir currency regimes a formato de scoreboard con score -3..+3
  const currencyScores = useMemo(() => {
    // If using endpoint data, return it directly
    if (useEndpointData && overviewData) {
      const rows = safeArray<CurrencyScoreLocal>(overviewData.currencyScoreboard as any)
      return rows.filter((c) => ALLOWED_CURRENCIES_UI.has(String(c?.currency || '').trim()))
    }
    
    if (!currencyRegimes) return []
    
    return Object.entries(currencyRegimes)
      .filter(([currency]) => ALLOWED_CURRENCIES_UI.has(String(currency || '').trim()))
      .map(([currency, regime]) => {
      // Convertir probability (0-1) a score -3..+3
      // Probability 0.5 = neutral (0), 1.0 = +3, 0.0 = -3
      const normalizedProb = (regime.probability - 0.5) * 6 // Escala 0-1 a -3..+3
      const score = Math.max(-3, Math.min(3, normalizedProb))
      
      // Determinar status basado en el régimen
      let status: 'Fuerte' | 'Neutro' | 'Débil' = 'Neutro'
      const regimeLower = regime.regime.toLowerCase()
      if (regimeLower.includes('goldilocks') || regimeLower.includes('reflation')) {
        status = 'Fuerte'
      } else if (regimeLower.includes('recession') || regimeLower.includes('stagflation')) {
        status = 'Débil'
      } else if (score > 1) {
        status = 'Fuerte'
      } else if (score < -1) {
        status = 'Débil'
      }

      return {
        currency,
        score,
        status,
      } as CurrencyScoreLocal
    })
  }, [currencyRegimes])

  // Determinar tendencias de crecimiento e inflación según horizonte temporal
  const { growthTrend, inflationTrend } = useMemo(() => {
    // If using endpoint data, return it directly
    if (useEndpointData && overviewData) {
      return {
        growthTrend: overviewData.regimeGlobal.growthTrend,
        inflationTrend: overviewData.regimeGlobal.inflationTrend,
      }
    }
    
    // FIX 1.2C: Si no hay indicadores, no inventar tendencias
    if (processedIndicators.length === 0) {
      return {
        growthTrend: null,
        inflationTrend: null,
      }
    }
    
    const growthIndicators = processedIndicators.filter(i => {
      const key = i.key.toUpperCase()
      return key.includes('GDP') || key.includes('PMI') || key.includes('RETAIL') || 
             key.includes('INDPRO') || key.includes('CONFIDENCE')
    })
    const inflationIndicators = processedIndicators.filter(i => {
      const key = i.key.toUpperCase()
      return key.includes('CPI') || key.includes('PCE') || key.includes('PPI')
    })
    
    let growthTrend: 'acelerando' | 'desacelerando' | 'estable' | null = 'estable'
    let inflationTrend: 'acelerando' | 'desacelerando' | 'estable' | null = 'estable'
    
    if (activeTab === 'monthly') {
      // Mensual: usar monthlyTrend
      const accelerating = growthIndicators.filter(i => i.monthlyTrend === 'acelerando').length
      const decelerating = growthIndicators.filter(i => i.monthlyTrend === 'desacelerando').length
      growthTrend = accelerating > decelerating ? 'acelerando' : decelerating > accelerating ? 'desacelerando' : 'estable'
      
      const infAccelerating = inflationIndicators.filter(i => i.monthlyTrend === 'acelerando').length
      const infDecelerating = inflationIndicators.filter(i => i.monthlyTrend === 'desacelerando').length
      inflationTrend = infAccelerating > infDecelerating ? 'acelerando' : infDecelerating > infAccelerating ? 'desacelerando' : 'estable'
    } else {
      // Diario/Semanal: usar tendencia normal
      const accelerating = growthIndicators.filter(i => i.trend === 'Mejora').length
      const decelerating = growthIndicators.filter(i => i.trend === 'Empeora').length
      growthTrend = accelerating > decelerating ? 'acelerando' : decelerating > accelerating ? 'desacelerando' : 'estable'
      
      const infAccelerating = inflationIndicators.filter(i => i.trend === 'Mejora').length
      const infDecelerating = inflationIndicators.filter(i => i.trend === 'Empeora').length
      inflationTrend = infAccelerating > infDecelerating ? 'acelerando' : infDecelerating > infAccelerating ? 'desacelerando' : 'estable'
    }
    
    return { growthTrend, inflationTrend }
  }, [processedIndicators, activeTab])

  // Calcular drivers principales y confianza según horizonte temporal
  const { topDrivers, confidence, confidenceExplanation } = useMemo(() => {
    // If using endpoint data, return it directly
    if (useEndpointData && overviewData) {
      return {
        topDrivers: overviewData.regimeGlobal.topDrivers,
        confidence: overviewData.regimeGlobal.confidence,
        confidenceExplanation: overviewData.regimeGlobal.confidenceExplanation,
      }
    }
    
    // OPTIMIZATION: Con useOptimizedEndpoint=true, esto normalmente no se ejecuta
    // Si se necesita (fallback SSR), retornar valores por defecto
    // El endpoint debería proporcionar los drivers y confianza
    return {
      topDrivers: [],
      confidence: 'Media' as const,
      confidenceExplanation: 'Calculado por endpoint (fallback SSR no implementado)',
    }
  }, [useEndpointData, overviewData, processedIndicators, activeTab])
  
  // Get regime data (for risk and usdDirection)
  const regimeData = useMemo(() => {
    if (useEndpointData && overviewData) {
      return {
        risk: overviewData.regimeGlobal.risk,
        usdDirection: overviewData.regimeGlobal.usdDirection,
      }
    }
    if (!initialData) {
      return { risk: 'Neutral' as const, usdDirection: 'Neutral' as const, growthTrend: 'estable' as const, inflationTrend: 'estable' as const, confidence: 'Baja' as const, confidenceExplanation: '', topDrivers: [] }
    }
    
    // Mapear usd_direction del backend a lenguaje macro
    const rawUsdDirection = initialData.regime.usd_direction || 'Neutral'
    const usdDirection: 'Fuerte' | 'Débil' | 'Neutral' = 
      rawUsdDirection === 'Bullish' || rawUsdDirection === 'Fuerte' ? 'Fuerte' :
      rawUsdDirection === 'Bearish' || rawUsdDirection === 'Débil' ? 'Débil' :
      'Neutral'
    
    return {
      risk: initialData.regime.risk as 'Risk ON' | 'Risk OFF' | 'Neutral',
      usdDirection,
    }
  }, [useEndpointData, overviewData, initialData])

  // OPTIMIZATION: Skeleton inmediato (no bloquea primer paint)
  // Esto mejora la "sensación" de velocidad incluso si el endpoint tarda
  if (loading && useOptimizedEndpoint && !initialData) {
    return (
      <div className="space-y-6">
        <MacroOverviewTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {/* Skeleton para mejor UX */}
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-24 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error && useOptimizedEndpoint && !initialData) {
    return (
      <div className="space-y-6">
        <MacroOverviewTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="text-center py-8 text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <MacroOverviewTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Contenido según tab activo */}
      <div className="space-y-6">
        {/* A. Global Regime */}
        <RegimeGlobalCard
          risk={regimeData.risk}
          usdDirection={regimeData.usdDirection}
          growthTrend={growthTrend}
          inflationTrend={inflationTrend}
          confidence={confidence}
          confidenceExplanation={confidenceExplanation}
          topDrivers={topDrivers}
          horizon={activeTab}
        />

        {/* B. Macro Drivers */}
        <CoreIndicatorsTable indicators={coreIndicators} horizon={activeTab} />

        {/* C. Currency Strength (solo USD/EUR/GBP/JPY) */}
        {currencyScores.length > 0 && (
          <CurrencyScoreboard
            currencies={currencyScores}
            showChange={activeTab === 'daily' || activeTab === 'weekly'}
          />
        )}

        {/* D. Macro Events */}
        <MacroEventsPanel />
      </div>
    </div>
  )
}
