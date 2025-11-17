/**
 * Export metrics in Prometheus format
 * GET /api/metrics/prometheus
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { exportPrometheusMetrics } from '@/lib/notifications/metrics'
import { getQueueStatus } from '@/lib/notifications/queue'

export async function GET() {
  try {
    // Get queue metrics
    const queueStatus = getQueueStatus()
    
    // Export Prometheus format
    let prometheusOutput = exportPrometheusMetrics()
    
    // Add queue metrics
    prometheusOutput += `# HELP notification_queue_size Current size of message queue\n`
    prometheusOutput += `# TYPE notification_queue_size gauge\n`
    prometheusOutput += `notification_queue_size ${queueStatus.queueLength}\n\n`
    
    prometheusOutput += `# HELP notification_rate_limit_global_used Messages sent in current window (global)\n`
    prometheusOutput += `# TYPE notification_rate_limit_global_used gauge\n`
    prometheusOutput += `notification_rate_limit_global_used ${queueStatus.globalRateLimit.used}\n\n`
    
    prometheusOutput += `# HELP notification_rate_limit_global_limit Maximum messages per minute (global)\n`
    prometheusOutput += `# TYPE notification_rate_limit_global_limit gauge\n`
    prometheusOutput += `notification_rate_limit_global_limit ${queueStatus.globalRateLimit.limit}\n\n`
    
    // Add per-chat metrics
    for (const chatLimit of queueStatus.chatRateLimits) {
      prometheusOutput += `# HELP notification_rate_limit_chat_used Messages sent in current window (per chat)\n`
      prometheusOutput += `# TYPE notification_rate_limit_chat_used gauge\n`
      prometheusOutput += `notification_rate_limit_chat_used{chat_id="${chatLimit.chatId}"} ${chatLimit.used}\n\n`
    }

    return new NextResponse(prometheusOutput, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[metrics/prometheus] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}





