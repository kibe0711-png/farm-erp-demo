"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────

interface PhasePerformance {
  phaseId: string;
  cropCode: string;
  areaHa: number;
  sowingDate: string;
  totalHarvestKg: number;
  totalPledgeKg: number;
  pledgeVariance: number;
  grade1Kg: number;
  grade2Kg: number;
  rejectKg: number;
  rejectRate: number;
  yieldPerHa: number;
}

interface FarmPerformance {
  farm: string;
  phaseCount: number;
  totalAreaHa: number;
  totalHarvestKg: number;
  totalPledgeKg: number;
  avgPledgeVariance: number;
  totalGrade1Kg: number;
  totalGrade2Kg: number;
  totalRejectKg: number;
  avgRejectRate: number;
  avgYieldPerHa: number;
  phases: PhasePerformance[];
}

interface PerformanceData {
  farms: FarmPerformance[];
  dateRange: {
    startDate: string;
    endDate: string;
    weeks: number;
    isPartialWeek: boolean;
  };
}

type DateRangeType = 1 | 3 | 8;

// ── Main Component ─────────────────────────────────────────────────

export default function PerformanceView() {
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>(3);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch data on mount and when date range changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/performance/stats?weeks=${dateRange}`);
        if (!response.ok) throw new Error("Failed to fetch performance data");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading performance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with date range selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Farm Performance</h2>
            <p className="text-sm text-gray-500">
              {data.dateRange.startDate} to {data.dateRange.endDate}
              {" "}({data.dateRange.weeks} week{data.dateRange.weeks > 1 ? "s" : ""})
              {data.dateRange.isPartialWeek && " + week to date"}
            </p>
          </div>
          <div className="flex gap-2">
            {[1, 3, 8].map((weeks) => (
              <button
                key={weeks}
                onClick={() => {
                  setDateRange(weeks as DateRangeType);
                  setSelectedFarm(null); // Reset farm selection on date change
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === weeks
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {weeks === 1 ? "Last Week" : `Last ${weeks} Weeks`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content: Farm cards or phase detail */}
      {!selectedFarm ? (
        <FarmCardsGrid farms={data.farms} onSelectFarm={setSelectedFarm} />
      ) : (
        <PhaseDetailView
          farm={data.farms.find((f) => f.farm === selectedFarm)!}
          onBack={() => setSelectedFarm(null)}
        />
      )}
    </div>
  );
}

// ── Farm Cards Grid ────────────────────────────────────────────────

function FarmCardsGrid({
  farms,
  onSelectFarm,
}: {
  farms: FarmPerformance[];
  onSelectFarm: (farm: string) => void;
}) {
  if (farms.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500">No performance data available for the selected period.</p>
        <p className="text-sm text-gray-400 mt-2">Record labor logs and harvest data to see metrics.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {farms.map((farm) => (
        <FarmCard key={farm.farm} farm={farm} onClick={() => onSelectFarm(farm.farm)} />
      ))}
    </div>
  );
}

// ── Farm Card ──────────────────────────────────────────────────────

function FarmCard({ farm, onClick }: { farm: FarmPerformance; onClick: () => void }) {
  const rejectColor = getRejectColor(farm.avgRejectRate);
  const varianceColor = getVarianceColor(farm.avgPledgeVariance, farm.totalPledgeKg > 0);
  const varianceValue = farm.totalPledgeKg > 0
    ? `${farm.avgPledgeVariance >= 0 ? "+" : ""}${farm.avgPledgeVariance.toFixed(1)}%`
    : "-";

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-emerald-300 cursor-pointer transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{farm.farm}</h3>
        <span className="text-gray-400 text-sm">→</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Metric label="Phases" value={farm.phaseCount.toString()} />
        <Metric label="Area (Ha)" value={farm.totalAreaHa.toFixed(2)} />
        <Metric
          label="Pledged (T)"
          value={farm.totalPledgeKg > 0 ? (farm.totalPledgeKg / 1000).toFixed(2) : "-"}
        />
        <Metric
          label="Harvest (T)"
          value={(farm.totalHarvestKg / 1000).toFixed(2)}
          highlight={farm.totalHarvestKg > 0}
        />
        <Metric label="Pledge vs Actual" value={varianceValue} color={varianceColor} />
        <Metric label="Reject Rate" value={`${farm.avgRejectRate.toFixed(1)}%`} color={rejectColor} />
      </div>
    </div>
  );
}

// ── Metric Component ───────────────────────────────────────────────

function Metric({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-base font-semibold ${
          color || (highlight ? "text-emerald-700" : "text-gray-900")
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Phase Detail View ──────────────────────────────────────────────

function PhaseDetailView({ farm, onBack }: { farm: FarmPerformance; onBack: () => void }) {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span>←</span>
        <span>Back to Farms</span>
      </button>

      {/* Farm summary card */}
      <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{farm.farm} - Performance Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Metric label="Total Phases" value={farm.phaseCount.toString()} />
          <Metric label="Total Area (Ha)" value={farm.totalAreaHa.toFixed(2)} />
          <Metric
            label="Total Pledged (T)"
            value={farm.totalPledgeKg > 0 ? (farm.totalPledgeKg / 1000).toFixed(2) : "-"}
          />
          <Metric label="Total Harvest (T)" value={(farm.totalHarvestKg / 1000).toFixed(2)} highlight />
          <Metric
            label="Pledge Variance"
            value={farm.totalPledgeKg > 0 ? `${farm.avgPledgeVariance >= 0 ? "+" : ""}${farm.avgPledgeVariance.toFixed(1)}%` : "-"}
            color={getVarianceColor(farm.avgPledgeVariance, farm.totalPledgeKg > 0)}
          />
        </div>
      </div>

      {/* Phase table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Phase</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Crop</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Area (Ha)</th>
                <th className="text-right py-3 px-4 font-medium text-blue-700">Pledged (T)</th>
                <th className="text-right py-3 px-4 font-medium text-emerald-700">Harvest (T)</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Variance</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Reject Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Yield/Ha (T)</th>
              </tr>
            </thead>
            <tbody>
              {farm.phases.map((phase) => (
                <PhaseRow key={phase.phaseId} phase={phase} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-emerald-50">
                <td colSpan={2} className="py-3 px-4 font-bold text-gray-900">
                  Farm Total
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">
                  {farm.totalAreaHa.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-blue-700">
                  {farm.totalPledgeKg > 0 ? (farm.totalPledgeKg / 1000).toFixed(2) : "-"}
                </td>
                <td className="py-3 px-4 text-right font-bold text-emerald-800">
                  {(farm.totalHarvestKg / 1000).toFixed(2)}
                </td>
                <td className={`py-3 px-4 text-right font-bold ${getVarianceColor(farm.avgPledgeVariance, farm.totalPledgeKg > 0)}`}>
                  {farm.totalPledgeKg > 0 ? `${farm.avgPledgeVariance >= 0 ? "+" : ""}${farm.avgPledgeVariance.toFixed(1)}%` : "-"}
                </td>
                <td className={`py-3 px-4 text-right font-bold ${getRejectColor(farm.avgRejectRate)}`}>
                  {farm.avgRejectRate.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">
                  {farm.avgYieldPerHa.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Phase Row ──────────────────────────────────────────────────────

function PhaseRow({ phase }: { phase: PhasePerformance }) {
  const rejectColor = getRejectColor(phase.rejectRate);
  const varianceColor = getVarianceColor(phase.pledgeVariance, phase.totalPledgeKg > 0);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 font-medium text-gray-900">{phase.phaseId}</td>
      <td className="py-3 px-4 text-gray-700">{phase.cropCode}</td>
      <td className="py-3 px-4 text-right text-gray-700 tabular-nums">{phase.areaHa.toFixed(2)}</td>
      <td className="py-3 px-4 text-right text-blue-700 tabular-nums">
        {phase.totalPledgeKg > 0 ? (phase.totalPledgeKg / 1000).toFixed(2) : "-"}
      </td>
      <td className="py-3 px-4 text-right text-emerald-700 tabular-nums font-medium">
        {(phase.totalHarvestKg / 1000).toFixed(2)}
      </td>
      <td className={`py-3 px-4 text-right tabular-nums font-medium ${varianceColor}`}>
        {phase.totalPledgeKg > 0 ? `${phase.pledgeVariance >= 0 ? "+" : ""}${phase.pledgeVariance.toFixed(1)}%` : "-"}
      </td>
      <td className={`py-3 px-4 text-right tabular-nums font-medium ${rejectColor}`}>
        {phase.rejectRate.toFixed(1)}%
      </td>
      <td className="py-3 px-4 text-right text-gray-700 tabular-nums">{phase.yieldPerHa.toFixed(2)}</td>
    </tr>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function getRejectColor(rejectRate: number): string {
  if (rejectRate < 8) return "text-green-600"; // Excellent
  if (rejectRate < 12) return "text-yellow-600"; // Acceptable
  return "text-red-600"; // Needs attention
}

function getVarianceColor(variance: number, hasPledge: boolean): string {
  if (!hasPledge) return "text-gray-400"; // No pledge data
  if (variance >= 0) return "text-green-600"; // Met or exceeded pledge
  if (variance >= -10) return "text-yellow-600"; // Close to pledge (within 10%)
  return "text-red-600"; // Under-delivered significantly
}
