/**
 * Snapshot Cache
 * 
 * Persistencia ligera del último snapshot validado para comparación.
 * Permite calcular deltas (score, drivers, régimen) entre snapshots.
 */

import 'server-only'
import { getUnifiedDB, isUsingTurso } from './unified-db'
import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import { createHash } from 'crypto'
import { logger } from '@/lib/obs/logger'

/**
 * Generate hash for snapshot (for deduplication)
 */
function hashSnapshot(snapshot: MacroSnapshot): string {
  // Create a stable hash from snapshot (excluding nowTs for comparison)
  const stableSnapshot = {
    regime: snapshot.regime,
    usdBias: snapshot.usdBias,
    score: snapshot.metrics?.score ?? snapshot.score,
    drivers: snapshot.drivers,
    correlations: snapshot.correlations,
  }
  const json = JSON.stringify(stableSnapshot)
  return createHash('sha256').update(json).digest('hex').substring(0, 16)
}

/**
 * Save snapshot to cache (only if different from last)
 */
export async function saveSnapshotToCache(snapshot: MacroSnapshot): Promise<void> {
  const requestId = 'snapshot-cache'
  const snapshotHash = hashSnapshot(snapshot)

  try {
    const db = getUnifiedDB()

    // Check if this snapshot already exists
    if (isUsingTurso()) {
      const existing = await db
        .prepare('SELECT id FROM macro_snapshot_cache WHERE snapshot_hash = ? ORDER BY created_at DESC LIMIT 1')
        .get(snapshotHash) as { id: number } | undefined

      if (existing) {
        logger.debug('snapshot.cache.skip', { requestId, snapshotHash, reason: 'duplicate' })
        return
      }

      // Insert new snapshot (keep only last 10 to avoid bloat)
      await db.prepare(`
        INSERT INTO macro_snapshot_cache (snapshot_json, snapshot_hash)
        VALUES (?, ?)
      `).run(JSON.stringify(snapshot), snapshotHash)

      // Cleanup: keep only last 10 snapshots
      await db.prepare(`
        DELETE FROM macro_snapshot_cache
        WHERE id NOT IN (
          SELECT id FROM macro_snapshot_cache
          ORDER BY created_at DESC
          LIMIT 10
        )
      `).run()
    } else {
      const existing = db
        .prepare('SELECT id FROM macro_snapshot_cache WHERE snapshot_hash = ? ORDER BY created_at DESC LIMIT 1')
        .get(snapshotHash) as { id: number } | undefined

      if (existing) {
        logger.debug('snapshot.cache.skip', { requestId, snapshotHash, reason: 'duplicate' })
        return
      }

      db.prepare(`
        INSERT INTO macro_snapshot_cache (snapshot_json, snapshot_hash)
        VALUES (?, ?)
      `).run(JSON.stringify(snapshot), snapshotHash)

      // Cleanup: keep only last 10 snapshots
      db.prepare(`
        DELETE FROM macro_snapshot_cache
        WHERE id NOT IN (
          SELECT id FROM macro_snapshot_cache
          ORDER BY created_at DESC
          LIMIT 10
        )
      `).run()
    }

    logger.debug('snapshot.cache.saved', { requestId, snapshotHash })
  } catch (error) {
    logger.warn('snapshot.cache.save_failed', {
      requestId,
      snapshotHash,
      error: error instanceof Error ? error.message : String(error),
    })
    // Non-blocking: continue even if cache fails
  }
}

/**
 * Get previous snapshot from cache (most recent before current)
 */
export async function getPreviousSnapshot(): Promise<MacroSnapshot | null> {
  const requestId = 'snapshot-cache'

  try {
    const db = getUnifiedDB()

    if (isUsingTurso()) {
      const row = await db
        .prepare('SELECT snapshot_json FROM macro_snapshot_cache ORDER BY created_at DESC LIMIT 1 OFFSET 1')
        .get() as { snapshot_json: string } | undefined

      if (!row) {
        return null
      }

      return JSON.parse(row.snapshot_json) as MacroSnapshot
    } else {
      const row = db
        .prepare('SELECT snapshot_json FROM macro_snapshot_cache ORDER BY created_at DESC LIMIT 1 OFFSET 1')
        .get() as { snapshot_json: string } | undefined

      if (!row) {
        return null
      }

      return JSON.parse(row.snapshot_json) as MacroSnapshot
    }
  } catch (error) {
    logger.warn('snapshot.cache.read_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

