"use client";

import { useState, useEffect } from "react";
import { useDashboard } from "../DashboardContext";

interface WeekBreakdown {
  weekStartDate: string;
  pledgeKg: number;
  actualKg: number;
  variance: number;
}

interface PhasePerformance {
  farmPhaseId: number;
  phaseId: string;
  cropCode: string;
  farm: string;
  areaHa: number;
  totalPledgeKg: number;
  totalActualKg: number;
  variance: number;
  fulfillmentRate: number;
  daysHarvested: number;
  weeklyBreakdown: WeekBreakdown[];
}

interface HarvestPerformanceResponse {
  phases: PhasePerformance[];
  includedWeeks: string[];
  dateRange: {
    startDate: string;
    endDate: string;
    weeks: number;
  };
  totals: {
    pledgeKg: number;
    actualKg: number;
    variance: number;
    fulfillmentRate: number;
  };
}

export default function HarvestPerformanceTab() {
  const { selectedMonday } = useDashboard();
  const [lookbackWeeks, setLookbackWeeks] = useState<number>(1);
  const [data, setData] = useState<HarvestPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch data when week or lookback changes
  useEffect(() => {
    fetchPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonday, lookbackWeeks]);

  const fetchPerformance = async () => {
    setLoading(true);
    setError("");
    try {
      const weekStr = selectedMonday.toISOString().split("T")[0];
      const res = await fetch(
        `/api/harvest/performance?weekStartDate=${weekStr}&lookbackWeeks=${lookbackWeeks}`
      );
      if (!res.ok) throw new Error("Failed to fetch performance data");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading harvest performance...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!data || data.phases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">Lookback Period:</label>
            <select
              value={lookbackWeeks}
              onChange={(e) => setLookbackWeeks(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value={1}>This Week Only</option>
              <option value={2}>Last 2 Weeks</option>
              <option value={4}>Last 4 Weeks</option>
              <option value={8}>Last 8 Weeks</option>
              <option value={12}>Last 12 Weeks</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">
            No harvest data found for selected period
          </p>
          <p className="text-sm text-gray-400">
            Create farmer pledges in the Farmer Pledge tab and record harvests
            in Harvest Records to see performance metrics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Lookback Period:</label>
          <select
            value={lookbackWeeks}
            onChange={(e) => setLookbackWeeks(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={1}>This Week Only</option>
            <option value={2}>Last 2 Weeks</option>
            <option value={4}>Last 4 Weeks</option>
            <option value={8}>Last 8 Weeks</option>
            <option value={12}>Last 12 Weeks</option>
          </select>
          <span className="text-sm text-gray-500">
            {data.includedWeeks.length} week{data.includedWeeks.length > 1 ? "s" : ""} included
          </span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Overall Performance ({data.dateRange.weeks} week{data.dateRange.weeks > 1 ? "s" : ""})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {(data.totals.pledgeKg / 1000).toFixed(2)}T
            </p>
            <p className="text-sm text-gray-600 mt-1">Total Pledged</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-600">
              {(data.totals.actualKg / 1000).toFixed(2)}T
            </p>
            <p className="text-sm text-gray-600 mt-1">Total Harvested</p>
          </div>
          <div className="text-center">
            <p
              className={`text-3xl font-bold ${getVarianceColor(data.totals.variance)}`}
            >
              {data.totals.variance >= 0 ? "+" : ""}
              {data.totals.variance.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 mt-1">Variance</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-700">
              {Math.min(100, data.totals.fulfillmentRate).toFixed(0)}%
            </p>
            <p className="text-sm text-gray-600 mt-1">Fulfillment Rate</p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-700">
                Phase
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">
                Crop
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">
                Farm
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Area (Ha)
              </th>
              <th className="text-right py-3 px-4 font-medium text-blue-700">
                Pledged (T)
              </th>
              <th className="text-right py-3 px-4 font-medium text-emerald-700">
                Harvested (T)
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Variance
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Days
              </th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">
                Weekly Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {data.phases.map((phase) => (
              <tr
                key={phase.farmPhaseId}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 px-4 font-medium text-gray-900">
                  {phase.phaseId}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                    {phase.cropCode}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700">{phase.farm}</td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {phase.areaHa.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-blue-700">
                  {(phase.totalPledgeKg / 1000).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                  {(phase.totalActualKg / 1000).toFixed(2)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-semibold ${getVarianceColor(phase.variance)}`}
                >
                  {phase.variance >= 0 ? "+" : ""}
                  {phase.variance.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {phase.daysHarvested}
                </td>
                <td className="py-3 px-4 text-center">
                  <WeeklyTrendBars breakdown={phase.weeklyBreakdown} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-emerald-50">
              <td colSpan={4} className="py-3 px-4 font-bold text-gray-900">
                Total
              </td>
              <td className="py-3 px-4 text-right font-bold text-blue-700">
                {(data.totals.pledgeKg / 1000).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right font-bold text-emerald-700">
                {(data.totals.actualKg / 1000).toFixed(2)}
              </td>
              <td
                className={`py-3 px-4 text-right font-bold ${getVarianceColor(data.totals.variance)}`}
              >
                {data.totals.variance >= 0 ? "+" : ""}
                {data.totals.variance.toFixed(1)}%
              </td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Helper function for variance color
function getVarianceColor(variance: number): string {
  if (variance >= -10 && variance <= 10) return "text-green-600"; // Within ±10%
  if (variance >= -20 && variance < -10) return "text-yellow-600"; // -20% to -10%
  return "text-red-600"; // Below -20% or above +10%
}

// Weekly Trend Visualization (Stacked Bars - Pledge vs Actual)
function WeeklyTrendBars({ breakdown }: { breakdown: WeekBreakdown[] }) {
  const maxKg = Math.max(
    ...breakdown.map((w) => Math.max(w.pledgeKg, w.actualKg)),
    1
  );

  return (
    <div className="flex items-end gap-0.5 justify-center h-8">
      {breakdown.map((week, idx) => {
        const pledgeHeight = (week.pledgeKg / maxKg) * 100;
        const actualHeight = (week.actualKg / maxKg) * 100;

        return (
          <div
            key={idx}
            className="relative group"
            title={`Week ${week.weekStartDate}:\nPledged: ${(week.pledgeKg / 1000).toFixed(2)}T\nHarvested: ${(week.actualKg / 1000).toFixed(2)}T\nVariance: ${week.variance.toFixed(1)}%`}
          >
            {/* Pledge bar (blue, background) */}
            <div
              className="w-3 bg-blue-400 opacity-50 rounded-t absolute bottom-0"
              style={{ height: `${Math.max(4, pledgeHeight)}%` }}
            />
            {/* Actual bar (green, foreground) */}
            <div
              className="w-3 bg-emerald-500 rounded-t relative"
              style={{ height: `${Math.max(4, actualHeight)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
