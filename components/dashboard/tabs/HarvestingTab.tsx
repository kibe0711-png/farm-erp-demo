"use client";

import { useState } from "react";
import WeekSelector from "../WeekSelector";
import HarvestGanttChart, { type HarvestPhaseRow } from "./HarvestGanttChart";
import { useDashboard } from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";

export default function HarvestingTab() {
  const {
    phases,
    selectedMonday,
    selectedWeek,
    farmSummaries,
    harvestLogs,
    handleHarvestLogSubmit,
    handleDeleteHarvestLog,
    user,
  } = useDashboard();

  const canEditGantt = !!user && hasPermission(user.role, Permission.EDIT_GANTT);

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({
    logDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [selectedLogPhase, setSelectedLogPhase] = useState<number | null>(null);

  const farmPhases = selectedFarm
    ? phases.filter((p) => p.farm === selectedFarm)
    : [];

  const farmPhaseIds = farmPhases.map((p) => p.id);

  const ganttPhases: HarvestPhaseRow[] = farmPhases.map((p) => ({
    farmPhaseId: p.id,
    cropCode: p.cropCode,
    phaseId: p.phaseId,
  }));

  const farmHarvestLogs = harvestLogs.filter((log) =>
    farmPhaseIds.includes(log.farmPhaseId)
  );

  const onLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogPhase) return;
    const phase = phases.find((p) => p.id === selectedLogPhase);
    if (!phase) return;
    try {
      await handleHarvestLogSubmit(logForm, phase);
      setLogForm({ logDate: new Date().toISOString().split("T")[0], notes: "" });
      setSelectedLogPhase(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    }
  };

  if (!selectedFarm) {
    return (
      <div className="space-y-6">
        <WeekSelector />
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
                className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-amber-300 hover:shadow-md transition-all"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{farm.farm}</h3>
                <p className="text-2xl font-bold text-green-600">
                  {farm.totalAcreage.toFixed(2)} Ha
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WeekSelector />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => setSelectedFarm(null)}
              className="text-sm text-amber-600 hover:text-amber-700 mb-2"
            >
              &larr; Back to farms
            </button>
            <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
            <p className="text-green-600 font-medium">
              {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Harvest Schedule &mdash; Week {selectedWeek}
          </h3>
          <HarvestGanttChart
            phases={ganttPhases}
            weekStartDate={selectedMonday}
            farmPhaseIds={farmPhaseIds}
            canEdit={canEditGantt}
          />
        </div>

        <div className="mb-6 p-4 bg-amber-50 rounded-lg">
          <h3 className="text-sm font-medium text-amber-800 mb-3">Record Harvest</h3>
          <form onSubmit={onLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phase</label>
                <select
                  value={selectedLogPhase ?? ""}
                  onChange={(e) => setSelectedLogPhase(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">Select phase...</option>
                  {farmPhases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cropCode} - {p.phaseId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={logForm.logDate}
                  onChange={(e) => setLogForm({ ...logForm, logDate: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700"
            >
              Log Harvest
            </button>
          </form>
        </div>

        {farmHarvestLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Harvest Logs</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Notes</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {farmHarvestLogs.map((log) => {
                  const phase = phases.find((p) => p.id === log.farmPhaseId);
                  return (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="py-2 px-2">
                        {phase ? `${phase.cropCode} - ${phase.phaseId}` : `Phase ${log.farmPhaseId}`}
                      </td>
                      <td className="py-2 px-2">{new Date(log.logDate).toLocaleDateString("en-GB")}</td>
                      <td className="py-2 px-2 text-gray-500">{log.notes || "-"}</td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handleDeleteHarvestLog(log.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
