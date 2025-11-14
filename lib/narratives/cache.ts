/**
 * Cache for detecting narrative changes
 * Prevents sending duplicate notifications
 */

let lastNarrativesHash = ''

export function narrativesChanged(narratives: Array<{ pair: string; narrative: string }>): boolean {
  // Create a hash from the narratives (only pair and key parts of narrative)
  const hash = JSON.stringify(
    narratives.map((n) => ({
      pair: n.pair,
      // Only include first line of narrative to detect meaningful changes
      summary: n.narrative.split('\n')[0],
    }))
  )

  if (hash !== lastNarrativesHash) {
    lastNarrativesHash = hash
    return true
  }

  return false
}

/**
 * Reset cache (useful for testing or manual resets)
 */
export function resetNarrativesCache(): void {
  lastNarrativesHash = ''
}





