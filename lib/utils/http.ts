/**
 * HTTP utilities with timeout, retry, and cache revalidation
 */

const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.MACRO_FETCH_TIMEOUT_MS || '8000',
  10
)
const DEFAULT_REVALIDATE_HOURS = parseInt(
  process.env.MACRO_DEFAULT_REVALIDATE_HOURS || '6',
  10
)

/**
 * Fetch with timeout and optional cache revalidation
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number; revalidateHours?: number }
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const revalidateHours = init?.revalidateHours ?? DEFAULT_REVALIDATE_HOURS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      next: {
        revalidate: revalidateHours * 3600, // Convert hours to seconds
      },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param retries Number of retries (default: 2)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2
): Promise<T> {
  let lastError: Error | null = null
  const delays = [300, 900] // Exponential backoff in ms

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < retries) {
        const delay = delays[attempt] || delays[delays.length - 1]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Retry failed')
}
