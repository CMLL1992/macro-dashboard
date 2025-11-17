/**
 * Stub for ingest module
 * TODO: Implement proper ingest logic or remove if not needed
 */

export async function ingestIndicator(id: string): Promise<{ success: boolean; count: number }> {
  console.warn(`[ingest] Stub called for indicator ${id}`)
  return { success: false, count: 0 }
}

