/**
 * Narrative state management and change detection
 * Caso B: Detectar y notificar cambios de narrativa macro
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { sendTelegramMessage } from './telegram'
import { getNotificationSettingNumber } from './settings'
import { incrementMetric } from './metrics'

export type NarrativeState = 'RISK_ON' | 'RISK_OFF' | 'INFLACION_ARRIBA' | 'INFLACION_ABAJO' | 'NEUTRAL'

// Get settings from DB or env or default
async function getCooldownMinutes(): Promise<number> {
  return (await getNotificationSettingNumber('NARRATIVE_COOLDOWN_MINUTES')) || 60
}

async function getDeltaInflPP(): Promise<number> {
  return (await getNotificationSettingNumber('DELTA_INFL_PP')) || 0.2
}

interface NewsItemForNarrative {
  titulo: string
  tema?: string
  valor_publicado?: number
  valor_esperado?: number
  published_at: string
}

/**
 * Get current narrative state
 */
export async function getCurrentNarrative(): Promise<NarrativeState> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  let row: { narrativa_actual: string } | undefined
  
  if (usingTurso) {
    row = await db.prepare('SELECT narrativa_actual FROM narrative_state ORDER BY id DESC LIMIT 1').get() as { narrativa_actual: string } | undefined
  } else {
    row = await db.prepare('SELECT narrativa_actual FROM narrative_state ORDER BY id DESC LIMIT 1').get() as { narrativa_actual: string } | undefined
  }
  
  return (row?.narrativa_actual as NarrativeState) || 'NEUTRAL'
}

/**
 * Check if cooldown is active
 */
async function isCooldownActive(): Promise<boolean> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  let row: { cooldown_hasta: string | null } | undefined
  
  if (usingTurso) {
    row = await db.prepare('SELECT cooldown_hasta FROM narrative_state ORDER BY id DESC LIMIT 1').get() as { cooldown_hasta: string | null } | undefined
  } else {
    row = await db.prepare('SELECT cooldown_hasta FROM narrative_state ORDER BY id DESC LIMIT 1').get() as { cooldown_hasta: string | null } | undefined
  }
  
  if (!row?.cooldown_hasta) return false

  const cooldownUntil = new Date(row.cooldown_hasta)
  return new Date() < cooldownUntil
}

/**
 * Calculate narrative candidate from news item
 */
export async function calculateNarrativeCandidate(
  newsItem: NewsItemForNarrative
): Promise<NarrativeState | null> {
  const { titulo, tema, valor_publicado, valor_esperado } = newsItem

  // Rule 1: Inflación - si hay valores y diferencia >= umbral
  if (tema?.toLowerCase().includes('infl') || tema?.toLowerCase().includes('cpi') || tema?.toLowerCase().includes('ppi')) {
    if (valor_publicado != null && valor_esperado != null) {
      const delta = valor_publicado - valor_esperado
      const deltaThreshold = await getDeltaInflPP()
      if (delta >= deltaThreshold) {
        return 'INFLACION_ARRIBA'
      } else if (delta <= -deltaThreshold) {
        return 'INFLACION_ABAJO'
      }
    }
  }

  // Rule 2: Crecimiento - keywords en título
  const tituloLower = titulo.toLowerCase()
  const positiveKeywords = ['above', 'accelerates', 'higher', 'hawkish', 'strong', 'beats', 'surpasses']
  const negativeKeywords = ['miss', 'lower', 'falls', 'dovish', 'weak', 'below', 'disappoints']

  const hasPositive = positiveKeywords.some(kw => tituloLower.includes(kw))
  const hasNegative = negativeKeywords.some(kw => tituloLower.includes(kw))

  // Rule 3: Crecimiento con valores
  if (tema?.toLowerCase().includes('nfp') || tema?.toLowerCase().includes('pmi') || tema?.toLowerCase().includes('ventas')) {
    if (valor_publicado != null && valor_esperado != null) {
      const delta = valor_publicado - valor_esperado
      if (delta < 0 && Math.abs(delta) > (valor_esperado * 0.05)) { // 5% worse
        return 'RISK_OFF'
      } else if (delta > 0 && delta > (valor_esperado * 0.05)) { // 5% better
        return 'RISK_ON'
      }
    }
  }

  // Rule 4: Keywords generales
  if (hasPositive && !hasNegative) {
    return 'RISK_ON'
  } else if (hasNegative && !hasPositive) {
    return 'RISK_OFF'
  }

  return null
}

/**
 * Check for multiple negative growth surprises on same day
 */
export async function checkMultipleNegativeSurprises(): Promise<NarrativeState | null> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Get today's news items with negative surprises
  let rows: Array<{ titulo: string; tema: string | null; valor_publicado: number; valor_esperado: number }>
  if (usingTurso) {
    rows = await db.prepare(`
      SELECT titulo, tema, valor_publicado, valor_esperado
      FROM news_items
      WHERE DATE(published_at) = ?
        AND impacto = 'high'
        AND valor_publicado IS NOT NULL
        AND valor_esperado IS NOT NULL
        AND (tema LIKE '%NFP%' OR tema LIKE '%PMI%' OR tema LIKE '%Ventas%' OR tema LIKE '%Crecimiento%')
      ORDER BY published_at DESC
    `).all(today) as Array<{ titulo: string; tema: string | null; valor_publicado: number; valor_esperado: number }>
  } else {
    rows = await db.prepare(`
      SELECT titulo, tema, valor_publicado, valor_esperado
      FROM news_items
      WHERE DATE(published_at) = ?
        AND impacto = 'high'
        AND valor_publicado IS NOT NULL
        AND valor_esperado IS NOT NULL
        AND (tema LIKE '%NFP%' OR tema LIKE '%PMI%' OR tema LIKE '%Ventas%' OR tema LIKE '%Crecimiento%')
      ORDER BY published_at DESC
    `).all(today) as Array<{ titulo: string; tema: string | null; valor_publicado: number; valor_esperado: number }>
  }

  // Count negative surprises (worse than expected)
  const negativeSurprises = rows.filter(row => {
    const delta = row.valor_publicado - row.valor_esperado
    return delta < 0 && Math.abs(delta) > (row.valor_esperado * 0.05)
  })

  if (negativeSurprises.length >= 2) {
    return 'RISK_OFF'
  }

  // Check for positive surprises
  const positiveSurprises = rows.filter(row => {
    const delta = row.valor_publicado - row.valor_esperado
    return delta > 0 && delta > (row.valor_esperado * 0.05)
  })

  if (positiveSurprises.length >= 2) {
    return 'RISK_ON'
  }

  return null
}

/**
 * Update narrative state and notify if changed
 */
export async function updateNarrative(
  candidate: NarrativeState,
  sourceNewsItem?: NewsItemForNarrative
): Promise<{ changed: boolean; notified: boolean; error?: string }> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  const current = await getCurrentNarrative()

  // If same state, no change
  if (candidate === current) {
    return { changed: false, notified: false }
  }

  // Check cooldown
  if (await isCooldownActive()) {
    return { changed: false, notified: false }
  }

  try {
    // Update state
    const cooldownUntil = new Date()
    const cooldownMinutes = await getCooldownMinutes()
    cooldownUntil.setMinutes(cooldownUntil.getMinutes() + cooldownMinutes)

    if (usingTurso) {
      await db.prepare(`
        INSERT INTO narrative_state (narrativa_actual, narrativa_anterior, cambiado_en, cooldown_hasta)
        VALUES (?, ?, ?, ?)
      `).run(
        candidate,
        current,
        new Date().toISOString(),
        cooldownUntil.toISOString()
      )
    } else {
      await db.prepare(`
        INSERT INTO narrative_state (narrativa_actual, narrativa_anterior, cambiado_en, cooldown_hasta)
        VALUES (?, ?, ?, ?)
      `).run(
        candidate,
        current,
        new Date().toISOString(),
        cooldownUntil.toISOString()
      )
    }

    // Build notification message
    const motivo = sourceNewsItem
      ? sourceNewsItem.valor_publicado != null && sourceNewsItem.valor_esperado != null
        ? `${sourceNewsItem.tema || 'Evento'} ${(sourceNewsItem.valor_publicado - sourceNewsItem.valor_esperado).toFixed(2)} vs esperado`
        : sourceNewsItem.titulo
      : 'Múltiples eventos'

    const message = `[NARRATIVA] → ${candidate}\n\nAntes: ${current} | Fuente: ${sourceNewsItem?.titulo || 'Sistema'}\n\nMotivo: ${motivo}`

    // Send notification
    const result = await sendTelegramMessage(message, { noParseMode: true })
    const now = new Date().toISOString()
    
    // Log to notification_history
    try {
      const dbHistory = getUnifiedDB()
      const usingTursoHistory = isUsingTurso()
      if (usingTursoHistory) {
        await dbHistory.prepare(`
          INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'narrative',
          message,
          result.success ? 'sent' : 'failed',
          result.success ? now : null,
          now
        )
      } else {
        await dbHistory.prepare(`
          INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'narrative',
          message,
          result.success ? 'sent' : 'failed',
          result.success ? now : null,
          now
        )
      }
    } catch (err) {
      console.warn('[narrative] Could not log to notification_history:', err)
    }
    
    if (result.success) {
      console.log('[narrative] Notification sent', {
        from: current,
        to: candidate,
        status: 'sent',
      })
      return { changed: true, notified: true }
    } else {
      console.error('[narrative] Notification failed', {
        from: current,
        to: candidate,
        status: 'failed',
        reason: result.error,
      })
      return { changed: true, notified: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { changed: true, notified: false, error: errorMessage }
  }
}

/**
 * Process news item and check for narrative changes
 */
export async function processNewsForNarrative(newsItem: NewsItemForNarrative): Promise<void> {
  // Calculate candidate from single news item
  const candidate1 = await calculateNarrativeCandidate(newsItem)
  if (candidate1) {
    await updateNarrative(candidate1, newsItem)
    return
  }

  // Check for multiple negative/positive surprises
  const candidate2 = await checkMultipleNegativeSurprises()
  if (candidate2) {
    await updateNarrative(candidate2, newsItem)
  }
}

