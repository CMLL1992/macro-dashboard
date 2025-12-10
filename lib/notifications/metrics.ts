/**
 * Notification metrics tracking
 * Simple counters for observability
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export interface Metric {
  metric_name: string
  metric_value: number
  labels?: string
}

/**
 * Increment metric counter
 */
export async function incrementMetric(metricName: string, labels?: string, amount: number = 1): Promise<void> {
  const db = getUnifiedDB()
  const labelsStr = labels ? JSON.stringify(labels) : null

  try {
    if (isUsingTurso()) {
      await db.prepare(`
        INSERT INTO notification_metrics (metric_name, metric_value, labels)
        VALUES (?, ?, ?)
        ON CONFLICT(metric_name, labels) DO UPDATE SET
          metric_value = metric_value + ?,
          updated_at = CURRENT_TIMESTAMP
      `).run(metricName, amount, labelsStr, amount)
    } else {
      await db.prepare(`
        INSERT INTO notification_metrics (metric_name, metric_value, labels)
        VALUES (?, ?, ?)
        ON CONFLICT(metric_name, labels) DO UPDATE SET
          metric_value = metric_value + ?,
          updated_at = CURRENT_TIMESTAMP
      `).run(metricName, amount, labelsStr, amount)
    }
  } catch (err) {
    console.warn(`[notifications/metrics] Could not increment ${metricName}:`, err)
  }
}

/**
 * Get metric value
 */
export async function getMetric(metricName: string, labels?: string): Promise<number> {
  const db = getUnifiedDB()
  const labelsStr = labels ? JSON.stringify(labels) : null

  try {
    let row: { metric_value: number } | undefined
    if (isUsingTurso()) {
      row = await db.prepare(`
        SELECT metric_value FROM notification_metrics
        WHERE metric_name = ? AND labels = ?
      `).get(metricName, labelsStr) as { metric_value: number } | undefined
    } else {
      row = await db.prepare(`
        SELECT metric_value FROM notification_metrics
        WHERE metric_name = ? AND labels = ?
      `).get(metricName, labelsStr) as { metric_value: number } | undefined
    }

    return row?.metric_value ?? 0
  } catch (err) {
    console.warn(`[notifications/metrics] Could not get ${metricName}:`, err)
    return 0
  }
}

/**
 * Get all metrics
 */
export async function getAllMetrics(): Promise<Metric[]> {
  const db = getUnifiedDB()

  try {
    let rows: Array<{
      metric_name: string
      metric_value: number
      labels: string | null
    }>
    
    if (isUsingTurso()) {
      rows = await db.prepare(`
        SELECT metric_name, metric_value, labels
        FROM notification_metrics
        ORDER BY metric_name, labels
      `).all() as Array<{
        metric_name: string
        metric_value: number
        labels: string | null
      }>
    } else {
      rows = await db.prepare(`
        SELECT metric_name, metric_value, labels
        FROM notification_metrics
        ORDER BY metric_name, labels
      `).all() as Array<{
        metric_name: string
        metric_value: number
        labels: string | null
      }>
    }

    return rows.map(row => ({
      metric_name: row.metric_name,
      metric_value: row.metric_value,
      labels: row.labels ? JSON.parse(row.labels) : undefined,
    }))
  } catch (err) {
    console.warn('[notifications/metrics] Could not read metrics:', err)
    return []
  }
}

/**
 * Get aggregated metrics for status
 */
export async function getAggregatedMetrics(): Promise<{
  sent_total: number
  failed_total: number
  rate_limited_total: number
}> {
  return {
    sent_total: await getMetric('notification_sent', 'status=sent'),
    failed_total: await getMetric('notification_sent', 'status=failed'),
    rate_limited_total: await getMetric('notification_rate_limited'),
  }
}

/**
 * Export metrics in Prometheus format
 */
export async function exportPrometheusMetrics(): Promise<string> {
  const metrics = await getAllMetrics()
  let output = ''

  // Add header
  output += '# HELP notification_metric Counter for notification metrics\n'
  output += '# TYPE notification_metric counter\n'

  // Add each metric
  for (const metric of metrics) {
    const labels = metric.labels ? JSON.stringify(metric.labels) : ''
    const labelStr = labels ? `{${Object.entries(metric.labels || {}).map(([k, v]) => `${k}="${v}"`).join(',')}}` : ''
    output += `notification_metric{metric_name="${metric.metric_name}"${labelStr ? ',' + labelStr.slice(1, -1) : ''}} ${metric.metric_value}\n`
  }

  return output
}


