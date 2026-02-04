"use client";

import { useState, useEffect, useCallback } from "react";
import WeekSelector from "../WeekSelector";
import { useDashboard } from "../DashboardContext";

interface PledgeEntry {
  farmPhaseId: number;
  weekStartDate: string;
  dayOfWeek: number;
  pledgeKg: string | number | null;
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

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({
    logDate: new Date().toISOString().split("T")[0],
    grade1Kg: "",
    grade2Kg: "",
    notes: "",
  });
  const [selectedLogPhase, setSelectedLogPhase] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pledges, setPledges] = useState<PledgeEntry[]>([]);

  const farmPhases = selectedFarm
    ? phases.filter((p) => p.farm === selectedFarm)
    : [];

  const farmPhaseIds = farmPhases.map((p) => p.id);

  const farmHarvestLogs = harvestLogs.filter((log) =>
    farmPhaseIds.includes(log.farmPhaseId)
  );

  const weekStr = selectedMonday.toISOString().split("T")[0];

  // Fetch pledges for this farm's phases
  const fetchPledges = useCallback(async () => {
    if (farmPhaseIds.length === 0) {
      setPledges([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/harvest-schedule?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        setPledges(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch pledges:", error);
    }
  }, [farmPhaseIds.join(","), weekStr]);

  useEffect(() => {
    fetchPledges();
  }, [fetchPledges]);

  // Helper to get pledge for a specific log date + phase
  const getPledgeForLog = (farmPhaseId: number, logDate: string): number => {
    const logDateObj = new Date(logDate);
    // Calculate which week this log belongs to (find the Monday of that week)
    const dayOfWeek = logDateObj.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days since Monday
    const logMonday = new Date(logDateObj);
    logMonday.setDate(logDateObj.getDate() - daysSinceMonday);
    const logWeekStr = logMonday.toISOString().split("T")[0];

    // dayOfWeek in pledge: 0 = Monday, 6 = Sunday
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
      setLogForm({ logDate: new Date().toISOString().split("T")[0], grade1Kg: "", grade2Kg: "", notes: "" });
      setSelectedLogPhase(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    } finally {
      setSubmitting(false);
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
                className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-green-300 hover:shadow-md transition-all"
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

        {farmHarvestLogs.length > 0 && (
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
                    const g1 = Number(log.grade1Kg) || 0;
                    const g2 = Number(log.grade2Kg) || 0;
                    const total = Number(log.actualKg) || (g1 + g2);
                    const pledged = getPledgeForLog(log.farmPhaseId, log.logDate);
                    const variance = pledged > 0 ? ((total - pledged) / pledged) * 100 : 0;
                    const varianceColor = pledged === 0
                      ? "text-gray-400"
                      : variance >= 0
                      ? "text-green-600"
                      : variance >= -10
                      ? "text-yellow-600"
                      : "text-red-600";

                    return (
                      <tr key={log.id} className="border-t border-gray-100">
                        <td className="py-2 px-3">
                          {phase ? `${phase.cropCode} - ${phase.phaseId}` : `Phase ${log.farmPhaseId}`}
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
        )}
      </div>
    </div>
  );
}
