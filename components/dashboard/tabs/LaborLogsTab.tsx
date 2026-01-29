"use client";

import { useState } from "react";
import WeekSelector from "../WeekSelector";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  type Phase,
} from "../DashboardContext";

export default function LaborLogsTab() {
  const {
    phases,
    laborSop,
    laborLogs,
    farms,
    selectedMonday,
    selectedWeek,
    farmSummaries,
    handleLaborLogSubmit,
    handleDeleteLaborLog,
  } = useDashboard();

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [logForm, setLogForm] = useState({
    task: "",
    casuals: "",
    logDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const farmPhases = selectedFarm ? phases.filter((p) => p.farm === selectedFarm) : [];

  // Farm labor rate
  const farmOverride = selectedFarm ? farms.find((f) => f.name === selectedFarm) : null;
  const laborRate = farmOverride?.laborRatePerDay != null
    ? parseFloat(String(farmOverride.laborRatePerDay))
    : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhase) return;
    try {
      await handleLaborLogSubmit(logForm, selectedPhase);
      setLogForm({ task: "", casuals: "", logDate: new Date().toISOString().split("T")[0], notes: "" });
      alert("Labor log saved successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    }
  };

  const onDelete = async (id: number) => {
    try { await handleDeleteLaborLog(id); } catch { alert("Failed to delete record"); }
  };

  // Week date range
  const weekEnd = new Date(selectedMonday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // ── Farm cards view ──────────────────────────────────────────────
  if (!selectedFarm) {
    return (
      <div className="space-y-6">
        <WeekSelector />
        {farmSummaries.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No farms found. Upload farm phases first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {farmSummaries.map((farm) => {
              const fp = phases.filter((p) => p.farm === farm.farm);

              // Budget = total expected labor cost from SOP this week
              let weeklyBudget = 0;
              fp.forEach((ph) => {
                const ws = calculateWeeksSinceSowing(ph.sowingDate, selectedMonday);
                const areaHa = parseFloat(String(ph.areaHa)) || 0;
                const farmRate = farms.find((f) => f.name === ph.farm);
                const rate = farmRate?.laborRatePerDay != null
                  ? parseFloat(String(farmRate.laborRatePerDay)) : 0;
                laborSop
                  .filter((s) => s.cropCode === ph.cropCode && s.week === ws)
                  .forEach((sop) => {
                    const costPerDay = (rate > 0) ? rate : parseFloat(String(sop.costPerCasualDay)) || 0;
                    weeklyBudget += sop.noOfCasuals * sop.noOfDays * areaHa * costPerDay;
                  });
              });

              // Actual spend from labor logs this week
              const farmLogRecords = laborLogs.filter((r) => {
                const d = new Date(r.logDate);
                return fp.some((p) => p.id === r.farmPhaseId) && d >= selectedMonday && d <= weekEnd;
              });
              const actualSpend = farmLogRecords.reduce(
                (sum, r) => sum + (parseFloat(String(r.totalCost)) || 0), 0
              );

              const budgetPct = weeklyBudget > 0 ? Math.min(100, (actualSpend / weeklyBudget) * 100) : 0;
              const totalLogs = farmLogRecords.length;

              return (
                <button
                  key={farm.farm}
                  onClick={() => { setSelectedFarm(farm.farm); setSelectedPhase(null); }}
                  className="bg-white rounded-xl border border-gray-200 p-8 text-left hover:border-indigo-300 hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{farm.farm}</h3>
                      <p className="text-sm text-gray-500">{farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{farm.totalAcreage.toFixed(2)} <span className="text-lg">Ha</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-100">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{weeklyBudget > 0 ? weeklyBudget.toLocaleString() : "0"}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Budget (RWF)</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${actualSpend > weeklyBudget && weeklyBudget > 0 ? "text-red-600" : "text-green-600"}`}>
                        {actualSpend > 0 ? actualSpend.toLocaleString() : "0"}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Actual (RWF)</p>
                    </div>
                  </div>

                  {/* Budget usage bar chart */}
                  {weeklyBudget > 0 ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 font-medium">Weekly Budget Used</span>
                        <span className={`text-lg font-bold ${budgetPct >= 100 ? "text-red-600" : budgetPct >= 80 ? "text-yellow-600" : "text-green-600"}`}>
                          {budgetPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-red-500" : budgetPct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(100, budgetPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : totalLogs > 0 ? (
                    <p className="text-xs text-gray-400 mt-4">No budget set (set labor rate in Farm Settings)</p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-4">No labor logs this week</p>
                  )}

                  {totalLogs > 0 && (
                    <p className="text-xs text-indigo-600 font-medium mt-2">{totalLogs} log{totalLogs !== 1 ? "s" : ""} recorded</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Phase selection view ────────────────────────────────────────
  if (selectedFarm && !selectedPhase) {
    return (
      <div className="space-y-6">
        <WeekSelector />
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <button onClick={() => setSelectedFarm(null)} className="text-sm text-indigo-600 hover:text-indigo-700 mb-2">
            &larr; Back to farms
          </button>
          <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
          <p className="text-green-600 font-medium mb-1">
            {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
          </p>
          {laborRate > 0 && (
            <p className="text-sm text-gray-500 mb-4">Labor rate: {laborRate.toLocaleString()} RWF/day</p>
          )}

          <h3 className="text-sm font-medium text-gray-700 mb-2">Select Phase to Record Labor</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Expected Tasks</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {farmPhases.map((phase) => {
                  const ws = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                  const expectedSop = laborSop.filter(
                    (sop) => sop.cropCode === phase.cropCode && sop.week === ws
                  );
                  const phaseLogsThisWeek = laborLogs.filter((r) => {
                    const d = new Date(r.logDate);
                    return r.farmPhaseId === phase.id && d >= selectedMonday && d <= weekEnd;
                  });

                  return (
                    <tr key={phase.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-700">{phase.phaseId}</td>
                      <td className="py-2 px-2">{phase.cropCode}</td>
                      <td className="py-2 px-2">{new Date(phase.sowingDate).toLocaleDateString("en-GB")}</td>
                      <td className="py-2 px-2">{parseFloat(String(phase.areaHa)).toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <span className={ws < 0 ? "text-gray-400" : "text-indigo-600 font-medium"}>{ws}</span>
                      </td>
                      <td className="py-2 px-2">
                        {expectedSop.length > 0 ? (
                          <span className="text-sm text-gray-600">{expectedSop.map((s) => s.task).join(", ")}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => setSelectedPhase(phase)}
                          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          Record {phaseLogsThisWeek.length > 0 && `(${phaseLogsThisWeek.length})`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Recording form (phase selected) ─────────────────────────────
  const weeksSinceSowing = selectedPhase
    ? calculateWeeksSinceSowing(selectedPhase.sowingDate, selectedMonday)
    : null;

  const expectedSop =
    selectedPhase && weeksSinceSowing !== null
      ? laborSop.filter((s) => s.cropCode === selectedPhase.cropCode && s.week === weeksSinceSowing)
      : [];

  const areaHa = selectedPhase ? parseFloat(String(selectedPhase.areaHa)) || 0 : 0;

  const phaseLogs = selectedPhase
    ? laborLogs.filter((r) => r.farmPhaseId === selectedPhase.id)
    : [];

  // Week logs for budget chart
  const weekPhaseLogs = phaseLogs.filter((r) => {
    const d = new Date(r.logDate);
    return d >= selectedMonday && d <= weekEnd;
  });

  // Expected tasks from SOP for this crop
  const cropTasks = selectedPhase
    ? [...new Set(laborSop.filter((s) => s.cropCode === selectedPhase.cropCode).map((s) => s.task))]
    : [];

  // Phase weekly budget
  let phaseBudget = 0;
  if (selectedPhase && weeksSinceSowing !== null) {
    expectedSop.forEach((sop) => {
      const costPerDay = (laborRate > 0) ? laborRate : parseFloat(String(sop.costPerCasualDay)) || 0;
      phaseBudget += sop.noOfCasuals * sop.noOfDays * areaHa * costPerDay;
    });
  }
  const phaseActual = weekPhaseLogs.reduce((sum, r) => sum + (parseFloat(String(r.totalCost)) || 0), 0);
  const phaseBudgetPct = phaseBudget > 0 ? Math.min(100, (phaseActual / phaseBudget) * 100) : 0;

  const casuals = parseInt(logForm.casuals) || 0;
  const costPerDay = laborRate > 0 ? laborRate : 0;
  const estimatedCost = casuals * costPerDay;

  return (
    <div className="space-y-6">
      <WeekSelector />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <button onClick={() => setSelectedPhase(null)} className="text-sm text-indigo-600 hover:text-indigo-700 mb-2">
          &larr; Back to phases
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {selectedPhase!.phaseId} - {selectedPhase!.cropCode}
        </h2>
        <p className="text-gray-600 mb-4">
          {selectedFarm} | {areaHa.toFixed(2)} Ha | Week {weeksSinceSowing}
          {laborRate > 0 && <> | Rate: {laborRate.toLocaleString()} RWF/day</>}
        </p>

        {/* Budget bar for this phase */}
        {phaseBudget > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Week {selectedWeek} Budget: {phaseBudget.toLocaleString()} RWF
              </span>
              <span className={`text-sm font-bold ${phaseBudgetPct >= 100 ? "text-red-600" : phaseBudgetPct >= 80 ? "text-yellow-600" : "text-green-600"}`}>
                {phaseActual.toLocaleString()} RWF ({phaseBudgetPct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${phaseBudgetPct >= 100 ? "bg-red-500" : phaseBudgetPct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                style={{ width: `${Math.min(100, phaseBudgetPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Expected SOP tasks */}
        {expectedSop.length > 0 ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Expected Tasks (from SOP)</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Task</th>
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Casuals</th>
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Days</th>
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {expectedSop.map((sop, i) => {
                  const sopCostPerDay = (laborRate > 0) ? laborRate : parseFloat(String(sop.costPerCasualDay)) || 0;
                  const sopTotal = sop.noOfCasuals * sop.noOfDays * areaHa * sopCostPerDay;
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 px-2">{sop.task}</td>
                      <td className="py-1 px-2">{sop.noOfCasuals}</td>
                      <td className="py-1 px-2">{sop.noOfDays}</td>
                      <td className="py-1 px-2">{sopTotal.toLocaleString()} RWF</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-700">No SOP entries for this crop/week combination.</p>
          </div>
        )}

        {/* Recording Form */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Record Actual Labor</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Task</label>
                <select
                  value={logForm.task}
                  onChange={(e) => setLogForm({ ...logForm, task: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select task...</option>
                  {cropTasks.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={logForm.logDate}
                  onChange={(e) => setLogForm({ ...logForm, logDate: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Number of Casuals</label>
                <input
                  type="number"
                  min="0"
                  value={logForm.casuals}
                  onChange={(e) => setLogForm({ ...logForm, casuals: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Total Cost</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-700">
                  {laborRate > 0 ? `${estimatedCost.toLocaleString()} RWF` : "Set labor rate in Farm Settings"}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
              />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">
              Save Record
            </button>
          </form>
        </div>

        {/* Existing logs */}
        {phaseLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Labor Log Records</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Task</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Casuals</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Cost/Day</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Total Cost</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Notes</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {phaseLogs.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 px-2">{new Date(r.logDate).toLocaleDateString("en-GB")}</td>
                    <td className="py-2 px-2">{r.task}</td>
                    <td className="py-2 px-2">{r.casuals}</td>
                    <td className="py-2 px-2">{parseFloat(String(r.costPerDay)).toLocaleString()}</td>
                    <td className="py-2 px-2 font-medium">{parseFloat(String(r.totalCost)).toLocaleString()} RWF</td>
                    <td className="py-2 px-2 text-gray-500">{r.notes || "-"}</td>
                    <td className="py-2 px-2">
                      <button onClick={() => onDelete(r.id)} className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
