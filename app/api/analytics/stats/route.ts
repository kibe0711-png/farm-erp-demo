import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { hasPermission, Permission } from "@/lib/auth/roles";

/**
 * GET /api/analytics/stats
 * Returns aggregated analytics data for the dashboard
 * Query params: startDate, endDate (optional, defaults to last 30 days)
 *
 * Requires ADMIN role
 */
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !hasPermission(authUser.role, Permission.MANAGE_USERS)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Default to last 30 days
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all analytics data in parallel
    const [analyticsEvents, apiPerformanceLogs, userSessions, users] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.apiPerformanceLog.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.userSession.findMany({
        where: {
          loginAt: { gte: startDate, lte: endDate },
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    // Build user map for quick lookups
    const userMap = new Map(users.map((u) => [u.id, u]));

    // === Feature Usage Aggregation ===
    const featureUsageMap = new Map<string, { viewCount: number; uniqueUsers: Set<number> }>();

    // Include page_view events
    analyticsEvents
      .filter((e) => e.eventType === "page_view")
      .forEach((event) => {
        const feature = event.eventName.replace(/^view_/, "");
        if (!featureUsageMap.has(feature)) {
          featureUsageMap.set(feature, { viewCount: 0, uniqueUsers: new Set() });
        }
        const stats = featureUsageMap.get(feature)!;
        stats.viewCount++;
        if (event.userId) {
          stats.uniqueUsers.add(event.userId);
        }
      });

    // Include operations sub-tab views (action events)
    analyticsEvents
      .filter((e) => e.eventType === "action" && e.eventName === "operations_subtab_view")
      .forEach((event) => {
        const metadata = event.metadata as { subtabLabel?: string } | null;
        const subtabLabel = metadata?.subtabLabel;
        if (subtabLabel) {
          const feature = `operations_${subtabLabel.toLowerCase().replace(/\s+/g, "_")}`;
          if (!featureUsageMap.has(feature)) {
            featureUsageMap.set(feature, { viewCount: 0, uniqueUsers: new Set() });
          }
          const stats = featureUsageMap.get(feature)!;
          stats.viewCount++;
          if (event.userId) {
            stats.uniqueUsers.add(event.userId);
          }
        }
      });

    const featureUsage = Array.from(featureUsageMap.entries())
      .map(([feature, stats]) => ({
        feature,
        viewCount: stats.viewCount,
        uniqueUsers: stats.uniqueUsers.size,
      }))
      .sort((a, b) => b.viewCount - a.viewCount);

    // === User Activity Aggregation ===
    const userActivityMap = new Map<number, {
      userId: number;
      userName: string;
      userEmail: string;
      userRole: string;
      loginCount: number;
      totalSessionSeconds: number;
      sessionCount: number;
      lastLogin: Date | null;
    }>();

    // Aggregate from user sessions
    userSessions.forEach((session) => {
      if (!userActivityMap.has(session.userId)) {
        userActivityMap.set(session.userId, {
          userId: session.userId,
          userName: session.user.name,
          userEmail: session.user.email,
          userRole: session.user.role,
          loginCount: 0,
          totalSessionSeconds: 0,
          sessionCount: 0,
          lastLogin: null,
        });
      }
      const stats = userActivityMap.get(session.userId)!;
      stats.loginCount++;
      if (session.duration) {
        stats.totalSessionSeconds += session.duration;
        stats.sessionCount++;
      }
      if (!stats.lastLogin || session.loginAt > stats.lastLogin) {
        stats.lastLogin = session.loginAt;
      }
    });

    const userActivity = Array.from(userActivityMap.values())
      .map((stats) => ({
        userId: stats.userId,
        userName: stats.userName,
        userEmail: stats.userEmail,
        userRole: stats.userRole,
        loginCount: stats.loginCount,
        avgSessionMinutes: stats.sessionCount > 0
          ? Math.round(stats.totalSessionSeconds / stats.sessionCount / 60)
          : 0,
        lastLogin: stats.lastLogin?.toISOString() || null,
      }))
      .sort((a, b) => b.loginCount - a.loginCount);

    // === API Performance Aggregation ===
    const apiPerformanceMap = new Map<string, {
      endpoint: string;
      method: string;
      callCount: number;
      totalResponseTime: number;
      errorCount: number;
      slowQueryCount: number;
    }>();

    apiPerformanceLogs.forEach((log) => {
      const key = `${log.method}:${log.endpoint}`;
      if (!apiPerformanceMap.has(key)) {
        apiPerformanceMap.set(key, {
          endpoint: log.endpoint,
          method: log.method,
          callCount: 0,
          totalResponseTime: 0,
          errorCount: 0,
          slowQueryCount: 0,
        });
      }
      const stats = apiPerformanceMap.get(key)!;
      stats.callCount++;
      stats.totalResponseTime += log.responseTime;
      if (log.statusCode >= 400) {
        stats.errorCount++;
      }
      if (log.responseTime > 1000) {
        stats.slowQueryCount++;
      }
    });

    const apiPerformance = Array.from(apiPerformanceMap.values())
      .map((stats) => ({
        endpoint: stats.endpoint,
        method: stats.method,
        callCount: stats.callCount,
        avgResponseTime: Math.round(stats.totalResponseTime / stats.callCount),
        errorRate: Math.round((stats.errorCount / stats.callCount) * 100),
        slowQueryCount: stats.slowQueryCount,
      }))
      .sort((a, b) => b.callCount - a.callCount);

    // === Slow Queries (>1000ms) ===
    const slowQueries = apiPerformance
      .filter((stat) => stat.avgResponseTime > 1000)
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime);

    // === Data Entry Metrics ===
    const dataEntryMap = new Map<string, { count: number; uniqueUsers: Set<number> }>();

    analyticsEvents
      .filter((e) => e.eventType === "action" && e.eventName === "data_entry")
      .forEach((event) => {
        const metadata = event.metadata as { type?: string } | null;
        const entryType = metadata?.type || "unknown";
        if (!dataEntryMap.has(entryType)) {
          dataEntryMap.set(entryType, { count: 0, uniqueUsers: new Set() });
        }
        const stats = dataEntryMap.get(entryType)!;
        stats.count++;
        if (event.userId) {
          stats.uniqueUsers.add(event.userId);
        }
      });

    const dataEntryStats = Array.from(dataEntryMap.entries())
      .map(([type, stats]) => ({
        entryType: type,
        count: stats.count,
        uniqueUsers: stats.uniqueUsers.size,
      }))
      .sort((a, b) => b.count - a.count);

    // === Recent Events (last 100, with user info) ===
    const recentEvents = analyticsEvents
      .slice(0, 100)
      .map((event) => ({
        id: event.id,
        eventType: event.eventType,
        eventName: event.eventName,
        userId: event.userId,
        userName: event.userId ? userMap.get(event.userId)?.name || "Unknown" : null,
        userRole: event.userRole,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      }));

    return NextResponse.json({
      featureUsage,
      userActivity,
      apiPerformance,
      slowQueries,
      dataEntryStats,
      recentEvents,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics stats" },
      { status: 500 }
    );
  }
}
