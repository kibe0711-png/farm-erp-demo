"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard, calculateWeeksSinceSowing } from "../DashboardContext";
import WeekSelector from "../WeekSelector";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Status = "done" | "missed" | "pending" | "upcoming";

interface ComplianceEntry {
  type: "labor" | "nutri" | "harvest";
  farmPhaseId: number;
  phaseId: string;
  farm: string;
  task: string;
  dayOfWeek: number;
  status: Status;
}

interface ComplianceSummary {
  total: number;
  done: number;
  missed: number;
  pending: number;
  upcoming: number;
  complianceRate: number | null;
}

interface ComplianceData {
  entries: ComplianceEntry[];
  summary: ComplianceSummary;
}

const STATUS_CELL: Record<Status, { bg: string; text: string; label: string }> = {
  done: { bg: "bg-green-600", text: "text-white", label: "Done" },
  missed: { bg: "bg-red-500", text: "text-white", label: "Missed" },
  pending: { bg: "bg-yellow-400", text: "text-yellow-900", label: "Pending" },
  upcoming: { bg: "bg-gray-100", text: "text-gray-400", label: "Upcoming" },
};

export default function DailyCompliance() {
  const { phases, selectedMonday, selectedWeek, farmSummaries } = useDashboard();

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);

  const weekStr = selectedMonday.toISOString().split("T")[0];

  const farmPhaseIds = selectedFarm
    ? phases
        .filter((p) => p.farm === selectedFarm)
        .filter((p) => calculateWeeksSinceSowing(p.sowingDate, selectedMonday) >= 0)
        .map((p) => p.id)
    : [];

  const fetchCompliance = useCallback(async () => {
    if (farmPhaseIds.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/compliance?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch compliance:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarm, weekStr, farmPhaseIds.join(",")]);

  useEffect(() => {
    if (selectedFarm) fetchCompliance();
  }, [fetchCompliance, selectedFarm]);

  // Group entries by "type-phaseId-task" for table rows
  const groupedRows = data
    ? Object.values(
        data.entries.reduce(
          (acc, entry) => {
            const key = `${entry.type}-${entry.farmPhaseId}-${entry.task}`;
            if (!acc[key]) {
              acc[key] = {
                key,
                type: entry.type,
                phaseId: entry.phaseId,
                task: entry.task,
                days: {} as Record<number, Status>,
              };
            }
            acc[key].days[entry.dayOfWeek] = entry.status;
            return acc;
          },
          {} as Record<string, { key: string; type: "labor" | "nutri" | "harvest"; phaseId: string; task: string; days: Record<number, Status> }>
        )
      )
    : [];

  // Sort: labor first, then nutri, then harvest, then by phaseId
  const typeOrder: Record<string, number> = { labor: 0, nutri: 1, harvest: 2 };
  groupedRows.sort((a, b) => {
    if (a.type !== b.type) return (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3);
    return a.phaseId.localeCompare(b.phaseId);
  });

  // Day column summaries
  const daySummaries = DAY_LABELS.map((_, dayIdx) => {
    if (!data) return { done: 0, missed: 0, pending: 0, total: 0 };
    const dayEntries = data.entries.filter((e) => e.dayOfWeek === dayIdx);
    return {
      done: dayEntries.filter((e) => e.status === "done").length,
      missed: dayEntries.filter((e) => e.status === "missed").length,
      pending: dayEntries.filter((e) => e.status === "pending").length,
      total: dayEntries.length,
    };
  });

  return (
    <div className="space-y-6">
      <WeekSelector />

      {!selectedFarm ? (
        <>
          {farmSummaries.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No farms found. Upload farm phases first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {farmSummaries.map((farm) => (
                <button
                  key={farm.farm}
                  onClick={() => setSelectedFarm(farm.farm)}
                  className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-orange-300 hover:shadow-md transition-all"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{farm.farm}</h3>
                  <p className="text-2xl font-bold text-orange-600">
                    {farm.totalAcreage.toFixed(2)} Ha
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => { setSelectedFarm(null); setData(null); }}
                className="text-sm text-orange-600 hover:text-orange-700 mb-2"
              >
                &larr; Back to farms
              </button>
              <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
              <p className="text-sm text-gray-500">
                Week {selectedWeek} Compliance
              </p>
            </div>
            {data?.summary.complianceRate !== null && data?.summary.complianceRate !== undefined && (
              <div className="text-right">
                <p className="text-3xl font-bold" style={{
                  color: data.summary.complianceRate >= 80 ? "#16a34a" : data.summary.complianceRate >= 50 ? "#ca8a04" : "#dc2626",
                }}>
                  {data.summary.complianceRate}%
                </p>
                <p className="text-xs text-gray-500">Compliance Rate</p>
              </div>
            )}
          </div>

          {/* Summary cards */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{data.summary.done}</p>
                <p className="text-xs text-green-600">Done</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{data.summary.missed}</p>
                <p className="text-xs text-red-500">Missed</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{data.summary.pending}</p>
                <p className="text-xs text-yellow-600">Pending Today</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{data.summary.upcoming}</p>
                <p className="text-xs text-gray-500">Upcoming</p>
              </div>
            </div>
          )}

          {/* Compliance table */}
          {loading ? (
            <div className="text-sm text-gray-500 py-4">Loading compliance data...</div>
          ) : !data || groupedRows.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No scheduled tasks for this week. Set up Gantt schedules first.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[60px]">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[80px]">Phase</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[150px]">Task</th>
                      {DAY_LABELS.map((day) => (
                        <th key={day} className="text-center py-2 px-1 font-medium text-gray-700 w-16">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((row, idx) => {
                      const prevRow = idx > 0 ? groupedRows[idx - 1] : null;
                      const isNewType = !prevRow || prevRow.type !== row.type;

                      return (
                        <tr
                          key={row.key}
                          className={`border-b border-gray-100 ${isNewType && idx > 0 ? "border-t-2 border-t-gray-300" : ""}`}
                        >
                          <td className="py-2 px-3">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              row.type === "labor"
                                ? "bg-teal-100 text-teal-700"
                                : row.type === "nutri"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {row.type === "labor" ? "Labor" : row.type === "nutri" ? "Nutri" : "Harvest"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-800 font-medium text-xs">{row.phaseId}</td>
                          <td className="py-2 px-3 text-gray-700 text-xs">{row.task}</td>
                          {DAY_LABELS.map((_, dayIdx) => {
                            const status = row.days[dayIdx];
                            if (!status) {
                              return (
                                <td key={dayIdx} className="py-1 px-1 text-center">
                                  <div className="w-full h-8 rounded bg-gray-50" />
                                </td>
                              );
                            }
                            const cell = STATUS_CELL[status];
                            return (
                              <td key={dayIdx} className="py-1 px-1 text-center">
                                <div className={`w-full h-8 rounded flex items-center justify-center text-xs font-semibold ${cell.bg} ${cell.text}`}>
                                  {cell.label}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={3} className="py-2 px-3 font-semibold text-gray-700 text-xs">
                        Daily Summary
                      </td>
                      {daySummaries.map((ds, idx) => (
                        <td key={idx} className="py-2 px-1 text-center">
                          {ds.total > 0 ? (
                            <div className="text-xs leading-tight">
                              {ds.done > 0 && <span className="text-green-700 font-semibold">{ds.done}&#10003; </span>}
                              {ds.missed > 0 && <span className="text-red-600 font-semibold">{ds.missed}&#10007; </span>}
                              {ds.pending > 0 && <span className="text-yellow-700 font-semibold">{ds.pending}? </span>}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-600" />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-400" />
              <span>Pending (today)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
              <span>Upcoming</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
