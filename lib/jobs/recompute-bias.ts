/**
 * Helper function to recompute bias and correlations
 * Centralized function that can be called from multiple places
 */

export async function recomputeAllBiasAndCorrelations(): Promise<void> {
  const token = process.env.CRON_TOKEN || ''
  const base = process.env.APP_URL || 'http://localhost:3000'
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any

  try {
    // Recalcular bias
    const biasResponse = await fetch(`${base}/api/jobs/compute/bias`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    })

    if (!biasResponse.ok) {
      throw new Error(`Bias recompute failed: ${biasResponse.status} ${biasResponse.statusText}`)
    }

    console.log('[recompute-bias] Bias recomputed successfully')

    // Opcional: también recalcular correlaciones si es necesario
    // Por ahora solo bias, ya que correlaciones se calculan menos frecuentemente
  } catch (error) {
    console.error('[recompute-bias] Error recomputing bias:', error)
    throw error
  }
}

