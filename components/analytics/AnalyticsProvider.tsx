"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { trackPageView, trackAction as trackActionUtil, trackTimeSpent } from "@/lib/analytics/tracker";

interface AnalyticsContextValue {
  trackAction: (actionName: string, metadata?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

interface AnalyticsProviderProps {
  children: ReactNode;
  currentPage: string;
}

// Only track operations tab - ignore other navigation
const TRACKED_PAGES = ["operations"];

/**
 * Analytics Provider
 * Wraps the dashboard and automatically tracks:
 * - Page views ONLY for operations tab (not other navigation)
 * - Time spent on operations tab
 * - Provides trackAction() for manual event tracking (data entries, etc.)
 */
export function AnalyticsProvider({ children, currentPage }: AnalyticsProviderProps) {
  const pageStartTime = useRef<number>(Date.now());
  const previousPage = useRef<string>(currentPage);

  useEffect(() => {
    // Only track specific pages (operations tab)
    if (TRACKED_PAGES.includes(currentPage)) {
      trackPageView(currentPage);
    }

    // Reset start time for new page
    pageStartTime.current = Date.now();
    previousPage.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    // Track time spent only for tracked pages
    return () => {
      if (TRACKED_PAGES.includes(previousPage.current)) {
        const timeSpent = Math.floor((Date.now() - pageStartTime.current) / 1000);
        if (timeSpent > 0) {
          trackTimeSpent(previousPage.current, timeSpent);
        }
      }
    };
  }, [currentPage]);

  const contextValue: AnalyticsContextValue = {
    trackAction: trackActionUtil,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook to access analytics tracking functions
 */
export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within AnalyticsProvider");
  }
  return context;
}
