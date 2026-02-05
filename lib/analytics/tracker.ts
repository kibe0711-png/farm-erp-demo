/**
 * Client-side analytics tracker
 * Provides functions to track page views, user actions, and time spent in different sections.
 */

interface AnalyticsEventData {
  eventType: "page_view" | "action" | "logout" | "error";
  eventName: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sends an analytics event to the server.
 * Uses navigator.sendBeacon() if available (for page unload events),
 * falls back to fetch() otherwise.
 */
async function sendEvent(data: AnalyticsEventData): Promise<void> {
  const payload = JSON.stringify(data);

  // Try sendBeacon first (works during page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const sent = navigator.sendBeacon("/api/analytics/events", blob);
    if (sent) return;
  }

  // Fallback to fetch
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true, // Important for events sent during page unload
    });
  } catch (error) {
    // Silently fail - don't break the app if analytics fails
    console.error("Failed to send analytics event:", error);
  }
}

/**
 * Tracks a page view / section visit
 */
export function trackPageView(pageName: string, metadata?: Record<string, unknown>): void {
  sendEvent({
    eventType: "page_view",
    eventName: `view_${pageName}`,
    metadata,
  });
}

/**
 * Tracks a user action (button click, form submission, etc.)
 */
export function trackAction(actionName: string, metadata?: Record<string, unknown>): void {
  sendEvent({
    eventType: "action",
    eventName: actionName,
    metadata,
  });
}

/**
 * Tracks time spent on a page/section
 * Call this when user leaves the section
 */
export function trackTimeSpent(pageName: string, seconds: number): void {
  if (seconds < 1) return; // Ignore very short visits

  sendEvent({
    eventType: "action",
    eventName: "time_spent",
    metadata: { page: pageName, seconds },
  });
}

/**
 * Tracks logout event
 */
export function trackLogout(): void {
  sendEvent({
    eventType: "logout",
    eventName: "logout",
  });
}

/**
 * Tracks an error event
 */
export function trackError(errorName: string, metadata?: Record<string, unknown>): void {
  sendEvent({
    eventType: "error",
    eventName: errorName,
    metadata,
  });
}
