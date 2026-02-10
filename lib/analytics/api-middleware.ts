import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

/**
 * Higher-order function that wraps API route handlers with analytics tracking.
 * Measures response time, captures errors, and logs to ApiPerformanceLog.
 *
 * Usage:
 * export const GET = withAnalytics(async (request: Request) => {
 *   // your handler code
 * });
 */
export function withAnalytics(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const startTime = Date.now();
    let statusCode = 200;
    let errorMessage: string | null = null;
    let userId: number | null = null;

    // Extract userId from JWT token if available
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("token")?.value;
      if (token) {
        const payload = await verifyToken(token);
        if (payload) {
          userId = payload.userId;
        }
      }
    } catch {
      // Ignore auth errors - not all endpoints require auth
    }

    // Extract endpoint path and method
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;

    try {
      // Call the actual handler
      const response = await handler(request);
      statusCode = response.status;

      // Capture error message if status is 4xx or 5xx
      if (statusCode >= 400) {
        try {
          const clonedResponse = response.clone();
          const body = await clonedResponse.json();
          errorMessage = body.error || body.message || `HTTP ${statusCode}`;
        } catch {
          errorMessage = `HTTP ${statusCode}`;
        }
      }

      // Buffer analytics log (flushed in batch, doesn't hit DB per request)
      const responseTime = Date.now() - startTime;
      bufferLogEntry({ endpoint, method, statusCode, responseTime, userId, errorMessage });

      return response;
    } catch (error) {
      // Handler threw an error
      statusCode = 500;
      errorMessage = error instanceof Error ? error.message : "Unknown error";

      const responseTime = Date.now() - startTime;
      bufferLogEntry({ endpoint, method, statusCode, responseTime, userId, errorMessage });

      // Re-throw the error so Next.js can handle it
      throw error;
    }
  };
}

// ── Batched analytics logging ────────────────────────────────────────
// Buffer entries and flush every 5 seconds or when buffer reaches 20 entries,
// using a single createMany call instead of one INSERT per request.

interface LogEntry {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId: number | null;
  errorMessage: string | null;
}

let logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function bufferLogEntry(entry: LogEntry) {
  logBuffer.push(entry);

  if (logBuffer.length >= 20) {
    flushLogs();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushLogs, 5_000);
  }
}

function flushLogs() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const entries = logBuffer;
  logBuffer = [];

  if (entries.length === 0) return;

  prisma.apiPerformanceLog
    .createMany({ data: entries })
    .catch((error) => {
      console.error("Failed to flush analytics logs:", error);
    });
}
