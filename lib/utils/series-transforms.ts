/**
 * Transformations for macroeconomic series
 * Calculates YoY, QoQ, and other percentage changes from level/index series
 */

import type { DataPoint } from '@/lib/types/macro'

/**
 * Calculate percentage change between two values
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0 || previous === null || current === null) {
    return null
  }
  return ((current - previous) / previous) * 100
}

/**
 * Calculate YoY (Year-over-Year) percentage change
 * For monthly series: compare with value 12 periods ago
 * For quarterly series: compare with value 4 periods ago
 * 
 * IMPORTANT: Data must be sorted by date ascending
 */
export function calculateYoY(data: DataPoint[], frequency: 'M' | 'Q' | 'A'): DataPoint[] {
  if (data.length === 0) return []
  
  // Ensure data is sorted by date (ascending)
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))
  
  const periodsBack = frequency === 'M' ? 12 : frequency === 'Q' ? 4 : 1
  const result: DataPoint[] = []
  
  for (let i = 0; i < sortedData.length; i++) {
    const current = sortedData[i]
    
    // Skip if current value is null
    if (current.value === null || current.value === undefined) {
      result.push({
        date: current.date,
        value: null,
      })
      continue
    }
    
    const previousIndex = i - periodsBack
    
    if (previousIndex >= 0 && previousIndex < sortedData.length) {
      const previous = sortedData[previousIndex]
      
      // Skip if previous value is null
      if (previous.value === null || previous.value === undefined) {
        result.push({
          date: current.date,
          value: null,
        })
        continue
      }
      
      const yoyValue = pctChange(current.value, previous.value)
      
      result.push({
        date: current.date,
        value: yoyValue,
      })
    } else {
      // Not enough history, set to null
      result.push({
        date: current.date,
        value: null,
      })
    }
  }
  
  // Filter out leading null values (but keep trailing nulls if any)
  let firstValidIndex = result.findIndex(dp => dp.value !== null)
  if (firstValidIndex === -1) {
    // No valid values, return empty
    return []
  }
  
  return result.slice(firstValidIndex)
}

/**
 * Calculate QoQ (Quarter-over-Quarter) percentage change
 * For quarterly series: compare with value 1 period ago
 * 
 * IMPORTANT: Data must be sorted by date ascending
 */
export function calculateQoQ(data: DataPoint[], frequency: 'Q' | 'M'): DataPoint[] {
  if (data.length === 0) return []
  
  if (frequency !== 'Q') {
    // QoQ only makes sense for quarterly data
    return data
  }
  
  // Ensure data is sorted by date (ascending)
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))
  
  const result: DataPoint[] = []
  
  for (let i = 0; i < sortedData.length; i++) {
    const current = sortedData[i]
    
    // Skip if current value is null
    if (current.value === null || current.value === undefined) {
      result.push({
        date: current.date,
        value: null,
      })
      continue
    }
    
    const previousIndex = i - 1
    
    if (previousIndex >= 0 && previousIndex < sortedData.length) {
      const previous = sortedData[previousIndex]
      
      // Skip if previous value is null
      if (previous.value === null || previous.value === undefined) {
        result.push({
          date: current.date,
          value: null,
        })
        continue
      }
      
      const qoqValue = pctChange(current.value, previous.value)
      
      result.push({
        date: current.date,
        value: qoqValue,
      })
    } else {
      // First data point, set to null
      result.push({
        date: current.date,
        value: null,
      })
    }
  }
  
  // Filter out leading null values
  let firstValidIndex = result.findIndex(dp => dp.value !== null)
  if (firstValidIndex === -1) {
    return []
  }
  
  return result.slice(firstValidIndex)
}

/**
 * Apply transformation to series based on indicator requirements
 */
export function applySeriesTransformation(
  data: DataPoint[],
  frequency: 'A' | 'Q' | 'M' | 'W' | 'D',
  transformType: 'yoy' | 'qoq' | 'none' = 'none'
): DataPoint[] {
  if (transformType === 'yoy') {
    if (frequency === 'M' || frequency === 'Q') {
      return calculateYoY(data, frequency)
    }
  } else if (transformType === 'qoq') {
    if (frequency === 'Q') {
      return calculateQoQ(data, frequency)
    }
  }
  
  // No transformation needed or not applicable
  return data
}
