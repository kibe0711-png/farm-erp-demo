"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import WeekSelector from "../WeekSelector";
import { useDashboard } from "../DashboardContext";
import { useAnalytics } from "../../analytics/AnalyticsProvider";

interface PledgeEntry {
  farmPhaseId: number;
  weekStartDate: string;
  dayOfWeek: number;
  pledgeKg: string | number | null;
}

// Local date string helper (avoids UTC shift from toISOString)
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HarvestRecordsTab() {
  const {
    phases,
    farmSummaries,
    harvestLogs,
    handleHarvestLogSubmit,
    handleDeleteHarvestLog,
    selectedMonday,
  } = useDashboard();
  const { trackAction } = useAnalytics();

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedLogPhase, setSelectedLogPhase] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pledges, setPledges] = useState<PledgeEntry[]>([]);
  const [allPledges, setAllPledges] = useState<PledgeEntry[]>([]);

  const weekStr = selectedMonday.toISOString().split("T")[0];

  // Week date range
  const weekEnd = useMemo(() => {
    const d = new Date(selectedMonday);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [selectedMonday]);

  const weekEndStr = toLocalDateStr(weekEnd);

  // Default form date: today if within selected week, otherwise Monday
  const today = toLocalDateStr(new Date());
  const defaultDate = (today >= weekStr && today <= weekEndStr) ? today : weekStr;

  const [logForm, setLogForm] = useState({
    logDate: defaultDate,
    grade1Kg: "",
    grade2Kg: "",
    notes: "",
  });

  // Reset form date when week changes
  useEffect(() => {
    const t = toLocalDateStr(new Date());
    const newDefault = (t >= weekStr && t <= weekEndStr) ? t : weekStr;
    setLogForm((prev) => ({ ...prev, logDate: newDefault }));
  }, [weekStr, weekEndStr]);

  // Today's day-of-week index (0=Mon..6=Sun) for WTD calculations
  const todayDow = useMemo(() => (new Date().getDay() + 6) % 7, []);

  // Active phases for the recording dropdown
  const farmPhases = selectedFarm
    ? phases.filter((p) => p.farm === selectedFarm && !p.archived)
    : [];

  // All phases (including archived) for logs, pledges, and WTD
  const allFarmPhases = selectedFarm
    ? phases.filter((p) => p.farm === selectedFarm)
    : [];
  const allFarmPhaseIds = allFarmPhases.map((p) => p.id);

  // Filter harvest logs to selected farm + selected week (includes archived phases)
  const farmHarvestLogs = useMemo(
    () => harvestLogs.filter((log) => {
      if (!allFarmPhaseIds.includes(log.farmPhaseId)) return false;
      const d = new Date(log.logDate);
      return d >= selectedMonday && d <= weekEnd;
    }),
    [harvestLogs, allFarmPhaseIds.join(","), selectedMonday, weekEnd]
  );

  // Fetch pledges for this farm's phases including archived (drill-in view)
  const fetchPledges = useCallback(async () => {
    if (allFarmPhaseIds.length === 0) {
      setPledges([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/harvest-schedule?farmPhaseIds=${allFarmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        setPledges(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch pledges:", error);
    }
  }, [allFarmPhaseIds.join(","), weekStr]);

  useEffect(() => {
    fetchPledges();
  }, [fetchPledges]);

  // Fetch pledges for ALL phases including archived (farm cards view — WTD summaries)
  const allPhaseIds = useMemo(() => phases.map((p) => p.id), [phases]);

  const fetchAllPledges = useCallback(async () => {
    if (allPhaseIds.length === 0) {
      setAllPledges([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/harvest-schedule?farmPhaseIds=${allPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        setAllPledges(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch all pledges:", error);
    }
  }, [allPhaseIds.join(","), weekStr]);

  useEffect(() => {
    if (!selectedFarm) fetchAllPledges();
  }, [fetchAllPledges, selectedFarm]);

  // Helper to get pledge for a specific log date + phase
  const getPledgeForLog = (farmPhaseId: number, logDate: string): number => {
    const logDateObj = new Date(logDate);
    const dayOfWeek = logDateObj.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const logMonday = new Date(logDateObj);
    logMonday.setDate(logDateObj.getDate() - daysSinceMonday);
    const logWeekStr = logMonday.toISOString().split("T")[0];

    const pledgeDayOfWeek = daysSinceMonday;

    const pledge = pledges.find(
      (p) =>
        p.farmPhaseId === farmPhaseId &&
        p.weekStartDate.split("T")[0] === logWeekStr &&
        p.dayOfWeek === pledgeDayOfWeek
    );

    return pledge?.pledgeKg != null ? Number(pledge.pledgeKg) : 0;
  };

  const onLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogPhase) return;
    const phase = phases.find((p) => p.id === selectedLogPhase);
    if (!phase) return;
    setSubmitting(true);
    try {
      await handleHarvestLogSubmit(logForm, phase);
      trackAction("data_entry", {
        type: "harvest_record",
        farm: phase.farm,
        crop: phase.cropCode,
        phase: phase.phaseId,
      });
      setLogForm({ logDate: defaultDate, grade1Kg: "", grade2Kg: "", notes: "" });
      setSelectedLogPhase(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // RENDER: Farm Cards View with WTD Summaries
  // ==========================================
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
            {farmSummaries.map((farm) => {
              // Compute WTD summaries per farm (includes archived phases)
              const fp = phases.filter((p) => p.farm === farm.farm);
              const fpIds = fp.map((p) => p.id);

              // Pledged WTD: only days Mon through today (dayOfWeek <= todayDow)
              const pledgedWtd = allPledges
                .filter((p) => fpIds.includes(p.farmPhaseId) && p.dayOfWeek <= todayDow)
                .reduce((sum, p) => sum + (Number(p.pledgeKg) || 0), 0);

              // Harvested WTD: logs from Mon through today
              const todayEnd = new Date();
              todayEnd.setHours(23, 59, 59, 999);
              const harvestedWtd = harvestLogs
                .filter((log) => {
                  if (!fpIds.includes(log.farmPhaseId)) return false;
                  const d = new Date(log.logDate);
                  return d >= selectedMonday && d <= todayEnd;
                })
                .reduce((sum, log) => sum + (Number(log.actualKg) || 0), 0);

              const fulfillmentPct = pledgedWtd > 0
                ? (harvestedWtd / pledgedWtd) * 100
                : 0;

              return (
                <button
                  key={farm.farm}
                  onClick={() => setSelectedFarm(farm.farm)}
                  className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-green-300 hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{farm.farm}</h3>
                      <p className="text-sm text-gray-500">
                        {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {farm.totalAcreage.toFixed(2)} <span className="text-sm font-medium">Ha</span>
                    </p>
                  </div>

                  {/* WTD Pledged vs Harvested */}
                  <div className="grid grid-cols-2 gap-4 py-3 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-600">
                        {pledgedWtd > 0 ? pledgedWtd.toLocaleString() : "0"}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Pledged WTD (Kg)</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-xl font-bold ${
                        harvestedWtd >= pledgedWtd && pledgedWtd > 0 ? "text-green-600" : "text-amber-600"
                      }`}>
                        {harvestedWtd > 0 ? harvestedWtd.toLocaleString() : "0"}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Harvested WTD (Kg)</p>
                    </div>
                  </div>

                  {/* Fulfillment progress bar */}
                  {pledgedWtd > 0 ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Fulfillment</span>
                        <span className={`text-sm font-bold ${
                          fulfillmentPct >= 100 ? "text-green-600"
                            : fulfillmentPct >= 80 ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {fulfillmentPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fulfillmentPct >= 100 ? "bg-green-500"
                              : fulfillmentPct >= 80 ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, fulfillmentPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : harvestedWtd > 0 ? (
                    <p className="text-xs text-gray-400 mt-3">No pledges set for this week</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Farm Drill-in View (Weekly Records)
  // ==========================================
  return (
    <div className="space-y-6">
      <WeekSelector />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <button
            onClick={() => setSelectedFarm(null)}
            className="text-sm text-green-600 hover:text-green-700 mb-2"
          >
            &larr; Back to farms
          </button>
          <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
          <p className="text-green-600 font-medium">
            {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
          </p>
        </div>

        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-3">Record Harvest</h3>
          <form onSubmit={onLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phase</label>
                <select
                  value={selectedLogPhase ?? ""}
                  onChange={(e) => setSelectedLogPhase(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  min={weekStr}
                  max={weekEndStr}
                  onChange={(e) => setLogForm({ ...logForm, logDate: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-green-700 mb-1 font-medium">Grade 1 (Kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={logForm.grade1Kg}
                  onChange={(e) => setLogForm({ ...logForm, grade1Kg: e.target.value })}
                  className="w-full border border-green-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-amber-700 mb-1 font-medium">Grade 2 (Kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={logForm.grade2Kg}
                  onChange={(e) => setLogForm({ ...logForm, grade2Kg: e.target.value })}
                  className="w-full border border-amber-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || (!logForm.grade1Kg && !logForm.grade2Kg)}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Log Harvest"}
            </button>
          </form>
        </div>

        {farmHarvestLogs.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Harvest Records</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Phase</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                    <th className="text-right py-2 px-3 font-medium text-blue-700">Pledged (Kg)</th>
                    <th className="text-right py-2 px-3 font-medium text-green-700">Grade 1 (Kg)</th>
                    <th className="text-right py-2 px-3 font-medium text-amber-700">Grade 2 (Kg)</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Total (Kg)</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Variance</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Notes</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {farmHarvestLogs.map((log) => {
                    const phase = phases.find((p) => p.id === log.farmPhaseId);
                    const isArchived = phase?.archived ?? false;
                    const g1 = Number(log.grade1Kg) || 0;
                    const g2 = Number(log.grade2Kg) || 0;
                    const total = Number(log.actualKg) || (g1 + g2);
                    const pledged = getPledgeForLog(log.farmPhaseId, log.logDate);
                    const variance = pledged > 0 ? ((total - pledged) / pledged) * 100 : 0;
                    const varianceColor = isArchived
                      ? "text-gray-400"
                      : pledged === 0
                      ? "text-gray-400"
                      : variance >= 0
                      ? "text-green-600"
                      : variance >= -10
                      ? "text-yellow-600"
                      : "text-red-600";

                    return (
                      <tr key={log.id} className={`border-t border-gray-100 ${isArchived ? "opacity-50" : ""}`}>
                        <td className="py-2 px-3">
                          {phase ? `${phase.cropCode} - ${phase.phaseId}` : `Phase ${log.farmPhaseId}`}
                          {isArchived && <span className="ml-1 text-xs text-gray-400">(archived)</span>}
                        </td>
                        <td className="py-2 px-3">{new Date(log.logDate).toLocaleDateString("en-GB")}</td>
                        <td className="py-2 px-3 text-right font-medium text-blue-700">
                          {pledged > 0 ? pledged.toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-green-700">
                          {g1 > 0 ? g1.toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-amber-700">
                          {g2 > 0 ? g2.toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-700">
                          {total.toLocaleString()}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${varianceColor}`}>
                          {pledged > 0 ? `${variance >= 0 ? "+" : ""}${variance.toFixed(0)}%` : "-"}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{log.notes || "-"}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => {
                              handleDeleteHarvestLog(log.id);
                              trackAction("data_delete", { type: "harvest_record", id: log.id });
                            }}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  {(() => {
                    const totalPledged = farmHarvestLogs.reduce(
                      (sum, log) => sum + getPledgeForLog(log.farmPhaseId, log.logDate),
                      0
                    );
                    const totalActual = farmHarvestLogs.reduce(
                      (sum, log) => sum + Number(log.actualKg),
                      0
                    );
                    const totalVariance = totalPledged > 0
                      ? ((totalActual - totalPledged) / totalPledged) * 100
                      : 0;
                    const totalVarianceColor = totalPledged === 0
                      ? "text-gray-400"
                      : totalVariance >= 0
                      ? "text-green-600"
                      : totalVariance >= -10
                      ? "text-yellow-600"
                      : "text-red-600";

                    return (
                      <tr className="border-t-2 border-gray-200">
                        <td colSpan={2} className="py-2 px-3 font-semibold text-gray-700">Total</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">
                          {totalPledged > 0 ? totalPledged.toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-green-700">
                          {farmHarvestLogs.reduce((sum, log) => sum + (Number(log.grade1Kg) || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-700">
                          {farmHarvestLogs.reduce((sum, log) => sum + (Number(log.grade2Kg) || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-gray-700">
                          {totalActual.toLocaleString()}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${totalVarianceColor}`}>
                          {totalPledged > 0 ? `${totalVariance >= 0 ? "+" : ""}${totalVariance.toFixed(0)}%` : "-"}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            No harvest records for this week.
          </div>
        )}
      </div>
    </div>
  );
}
