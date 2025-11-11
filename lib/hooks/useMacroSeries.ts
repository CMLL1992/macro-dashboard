/**
 * React hook for fetching macro series data
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import type { MacroSeries, Source } from '@/lib/types/macro'

export interface UseMacroSeriesParams {
  source: 'WORLD_BANK' | 'IMF' | 'ECB_SDW'
  params: Record<string, string>
}

export interface UseMacroSeriesResult {
  data: MacroSeries | undefined
  isLoading: boolean
  error?: string
}

// Cache by series ID
const cache = new Map<string, { data: MacroSeries; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCacheKey(source: string, params: Record<string, string>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return `${source}:${sortedParams}`
}

export function useMacroSeries(
  source: UseMacroSeriesParams['source'],
  params: Record<string, string>
): UseMacroSeriesResult {
  const [data, setData] = useState<MacroSeries | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  const cacheKey = useMemo(() => getCacheKey(source, params), [source, params])

  useEffect(() => {
    // Check cache first
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data)
      setIsLoading(false)
      return
    }

    // Build API URL
    const endpointMap: Record<typeof source, string> = {
      WORLD_BANK: 'worldbank',
      IMF: 'imf',
      ECB_SDW: 'ecb',
    }
    const endpoint = `/api/macro/${endpointMap[source]}`
    const searchParams = new URLSearchParams(params)
    const url = `${endpoint}?${searchParams.toString()}`

    setIsLoading(true)
    setError(undefined)

    let retries = 2
    const fetchData = async (): Promise<void> => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`
          )
        }

        const series: MacroSeries = await response.json()
        setData(series)
        setError(undefined)

        // Update cache
        cache.set(cacheKey, { data: series, timestamp: Date.now() })
      } catch (err) {
        if (retries > 0) {
          retries--
          await new Promise((resolve) => setTimeout(resolve, 300))
          return fetchData()
        }
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        setData(undefined)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [cacheKey, source, params])

  return { data, isLoading, error }
}

