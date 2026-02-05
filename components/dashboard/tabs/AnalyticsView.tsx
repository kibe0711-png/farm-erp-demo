"use client";

import { useState, useEffect, useCallback } from "react";

// Types
interface FeatureUsageItem {
  feature: string;
  viewCount: number;
  uniqueUsers: number;
}

interface UserActivityItem {
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  loginCount: number;
  avgSessionMinutes: number;
  lastLogin: string | null;
}

interface ApiPerformanceItem {
  endpoint: string;
  method: string;
  callCount: number;
  avgResponseTime: number;
  errorRate: number;
  slowQueryCount: number;
}

interface RecentEventItem {
  id: number;
  eventType: string;
  eventName: string;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AnalyticsData {
  featureUsage: FeatureUsageItem[];
  userActivity: UserActivityItem[];
  apiPerformance: ApiPerformanceItem[];
  slowQueries: ApiPerformanceItem[];
  recentEvents: RecentEventItem[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

type TabType = "feature" | "user" | "api" | "events";
type DateRangeType = "7d" | "30d" | "90d";

export default function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<TabType>("feature");
  const [dateRange, setDateRange] = useState<DateRangeType>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endDate = new Date();
      const startDate = new Date();
      if (dateRange === "7d") {
        startDate.setDate(endDate.getDate() - 7);
      } else if (dateRange === "30d") {
        startDate.setDate(endDate.getDate() - 30);
      } else if (dateRange === "90d") {
        startDate.setDate(endDate.getDate() - 90);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const res = await fetch(`/api/analytics/stats?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load analytics");
      }
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error || "No data available"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Application usage and performance metrics</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        {(["7d", "30d", "90d"] as DateRangeType[]).map((range) => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              dateRange === range
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {[
            { id: "feature" as TabType, label: "Feature Usage" },
            { id: "user" as TabType, label: "User Activity" },
            { id: "api" as TabType, label: "API Performance" },
            { id: "events" as TabType, label: "Recent Events" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {activeTab === "feature" && <FeatureUsageTab data={data.featureUsage} />}
        {activeTab === "user" && <UserActivityTab data={data.userActivity} />}
        {activeTab === "api" && <ApiPerformanceTab data={data.apiPerformance} slowQueries={data.slowQueries} />}
        {activeTab === "events" && <RecentEventsTab data={data.recentEvents} />}
      </div>
    </div>
  );
}

// === Feature Usage Tab ===
function FeatureUsageTab({ data }: { data: FeatureUsageItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="No feature usage data yet" />;
  }

  const maxViews = Math.max(...data.map((item) => item.viewCount));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 font-medium text-gray-700">Feature</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">Views</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">Unique Users</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Popularity</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-900 capitalize">
                {item.feature.replace(/_/g, " ")}
              </td>
              <td className="py-3 px-4 text-right text-gray-700">{item.viewCount}</td>
              <td className="py-3 px-4 text-right text-gray-700">{item.uniqueUsers}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-violet-600 h-2 rounded-full"
                      style={{ width: `${(item.viewCount / maxViews) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {Math.round((item.viewCount / maxViews) * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === User Activity Tab ===
function UserActivityTab({ data }: { data: UserActivityItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="No user activity data yet" />;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">Logins</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">Avg Session</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Last Login</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const lastLogin = item.lastLogin ? new Date(item.lastLogin) : null;
            const isInactive = lastLogin && lastLogin < sevenDaysAgo;

            return (
              <tr
                key={item.userId}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  isInactive ? "bg-yellow-50" : ""
                }`}
              >
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-gray-900">{item.userName}</div>
                    <div className="text-xs text-gray-500">{item.userEmail}</div>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-700">{item.userRole}</td>
                <td className="py-3 px-4 text-right text-gray-700">{item.loginCount}</td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {item.avgSessionMinutes > 0 ? `${item.avgSessionMinutes} min` : "-"}
                </td>
                <td className="py-3 px-4 text-gray-700">
                  {lastLogin ? (
                    <span className={isInactive ? "text-yellow-700 font-medium" : ""}>
                      {lastLogin.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {isInactive && " (inactive)"}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// === API Performance Tab ===
function ApiPerformanceTab({
  data,
  slowQueries,
}: {
  data: ApiPerformanceItem[];
  slowQueries: ApiPerformanceItem[];
}) {
  if (data.length === 0) {
    return <EmptyState message="No API performance data yet" />;
  }

  return (
    <div className="space-y-6 p-4">
      {/* Slow Queries Alert */}
      {slowQueries.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            Slow Queries ({slowQueries.length})
          </h3>
          <div className="text-xs text-yellow-700 space-y-1">
            {slowQueries.slice(0, 3).map((query, idx) => (
              <div key={idx}>
                {query.method} {query.endpoint} - {query.avgResponseTime}ms avg
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Endpoint</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Method</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Calls</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Avg Time (ms)</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const isSlow = item.avgResponseTime > 1000;
              const isErrorProne = item.errorRate > 5;

              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    isSlow ? "bg-yellow-50" : isErrorProne ? "bg-red-50" : ""
                  }`}
                >
                  <td className="py-3 px-4 font-mono text-xs text-gray-900">{item.endpoint}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {item.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.callCount}</td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      isSlow ? "text-yellow-700" : "text-gray-700"
                    }`}
                  >
                    {item.avgResponseTime}ms
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      isErrorProne ? "text-red-700" : "text-gray-700"
                    }`}
                  >
                    {item.errorRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Recent Events Tab ===
function RecentEventsTab({ data }: { data: RecentEventItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="No events logged yet" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 font-medium text-gray-700">Time</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Event</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
          </tr>
        </thead>
        <tbody>
          {data.map((event) => (
            <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-xs text-gray-500">
                {new Date(event.createdAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    event.eventType === "login"
                      ? "bg-green-100 text-green-700"
                      : event.eventType === "logout"
                      ? "bg-gray-100 text-gray-700"
                      : event.eventType === "page_view"
                      ? "bg-blue-100 text-blue-700"
                      : event.eventType === "error"
                      ? "bg-red-100 text-red-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {event.eventType}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-700 font-mono text-xs">{event.eventName}</td>
              <td className="py-3 px-4 text-gray-700">{event.userName || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Empty State ===
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-500">
      <p>{message}</p>
      <p className="text-sm mt-2">Start using the app to see metrics here.</p>
    </div>
  );
}
