/**
 * Fetch wrapper with exponential backoff retry for transient failures.
 * Retries on network errors and 5xx responses (server/DB issues).
 * Does NOT retry on 4xx (client errors like 400, 403, 404).
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2,
  baseDelayMs = 500
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Don't retry client errors (4xx) — only retry server errors (5xx)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      // 5xx — worth retrying
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return res; // Final attempt, return whatever we got
    } catch (error) {
      // Network error (DNS, timeout, connection refused)
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`fetchWithRetry failed after ${maxRetries + 1} attempts`);
}
