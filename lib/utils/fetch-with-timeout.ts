/**
 * Fetch with timeout helper
 * Prevents hanging requests in polling scenarios
 */

export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  ms = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
