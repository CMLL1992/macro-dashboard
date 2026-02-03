/**
 * Narratives Adapter
 * 
 * Convierte narrativas del sistema a NarrativeSchema
 * para el Macro Snapshot.
 */

import { getCurrentNarrative } from '@/lib/notifications/narrative'
import { getWeeklyExtensiveNarrative } from '@/lib/narratives/extensive'
import type { Narrative } from '../schema'
import { ConfidenceEnum } from '../schema'
import { logger } from '@/lib/obs/logger'

/**
 * Extract narrative from system
 * 
 * Rules:
 * - headline string "safe"
 * - bullets array non-empty (if exists)
 * - tags/sources optional
 * - If fails: logger.warn and return undefined
 * 
 * @returns Narrative or undefined
 */
export async function extractNarrative(): Promise<Narrative | undefined> {
  try {
    // Get current narrative state
    const narrativeState = await getCurrentNarrative()
    
    // Get extensive narrative (weekly summary)
    let extensiveNarrative: string | null = null
    try {
      extensiveNarrative = await getWeeklyExtensiveNarrative()
    } catch (error) {
      logger.info('snapshot.narrative.extensive_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      // Continue without extensive narrative
    }
    
    // Build headline from narrative state
    const headline = buildHeadline(narrativeState)
    
    // Build bullets from extensive narrative or narrative state
    const bullets = buildBullets(narrativeState, extensiveNarrative)
    
    // Determine confidence based on narrative state
    const confidence = determineConfidence(narrativeState)
    
    // Build tags
    const tags = buildTags(narrativeState)
    
    if (bullets.length === 0) {
      logger.warn('snapshot.narrative.empty_bullets', {
        narrativeState,
      })
      return undefined
    }
    
    const narrative: Narrative = {
      headline,
      bullets,
      confidence,
      tags: tags.length > 0 ? tags : undefined,
    }
    
    logger.info('snapshot.narrative.extracted', {
      headline,
      bulletsCount: bullets.length,
      confidence,
    })
    
    return narrative
  } catch (error) {
    logger.warn('snapshot.narrative.extract_error', {
      error,
      cause: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

/**
 * Build headline from narrative state
 */
function buildHeadline(narrativeState: string): string {
  const stateMap: Record<string, string> = {
    'RISK_ON': 'Régimen de Riesgo: Risk ON',
    'RISK_OFF': 'Régimen de Riesgo: Risk OFF',
    'INFLACION_ARRIBA': 'Inflación: Presión Alcista',
    'INFLACION_ABAJO': 'Inflación: Presión Bajista',
    'NEUTRAL': 'Régimen Macro: Neutral',
  }
  
  return stateMap[narrativeState] || `Régimen Macro: ${narrativeState}`
}

/**
 * Build bullets from narrative state and extensive narrative
 */
function buildBullets(narrativeState: string, extensiveNarrative: string | null): string[] {
  const bullets: string[] = []
  
  // Add state-specific bullet
  bullets.push(`Estado actual: ${narrativeState}`)
  
  // Add extensive narrative as bullets (split by paragraphs or lines)
  if (extensiveNarrative) {
    // Split by double newlines (paragraphs) or single newlines
    const paragraphs = extensiveNarrative
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
    
    // Take first 3 paragraphs as bullets
    for (const paragraph of paragraphs.slice(0, 3)) {
      // Clean up paragraph (remove markdown, etc.)
      const clean = paragraph
        .replace(/\*\*/g, '') // Remove bold
        .replace(/\*/g, '') // Remove italic
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
        .trim()
      
      if (clean.length > 0 && clean.length < 200) {
        bullets.push(clean)
      }
    }
  }
  
  return bullets
}

/**
 * Determine confidence from narrative state
 */
function determineConfidence(narrativeState: string): 'Alta' | 'Media' | 'Baja' {
  // High confidence states
  if (narrativeState === 'RISK_ON' || narrativeState === 'RISK_OFF') {
    return 'Alta'
  }
  
  // Medium confidence states
  if (narrativeState === 'INFLACION_ARRIBA' || narrativeState === 'INFLACION_ABAJO') {
    return 'Media'
  }
  
  // Low confidence (neutral)
  return 'Baja'
}

/**
 * Build tags from narrative state
 */
function buildTags(narrativeState: string): string[] {
  const tags: string[] = []
  
  if (narrativeState.includes('RISK')) {
    tags.push('risk-regime')
  }
  if (narrativeState.includes('INFLACION')) {
    tags.push('inflation')
  }
  if (narrativeState === 'NEUTRAL') {
    tags.push('neutral')
  }
  
  tags.push(narrativeState.toLowerCase())
  
  return tags
}

