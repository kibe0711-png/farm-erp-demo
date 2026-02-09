"use client";

import { useState, useEffect, useCallback } from "react";
import WeekSelector from "../WeekSelector";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  type Phase,
} from "../DashboardContext";
import { isRoleAtLeast, UserRole } from "@/lib/auth/roles";
import { useAnalytics } from "../../analytics/AnalyticsProvider";

interface FeedingSnapshotEntry {
  farmPhaseId: number;
  phaseId: string;
  cropCode: string;
  farm: string;
  product: string;
  expectedRateHa: number;
  expectedQty: number;
  actualQty: number;
  actualRateHa: number;
  variance: number;
}

interface SnapshotInfo {
  exists: boolean;
  snapshotAt?: string;
  savedByName?: string;
  entryCount?: number;
}

export default function FeedingTab() {
  const {
    phases,
    nutriSop,
    feedingRecords,
    selectedMonday,
    farmSummaries,
    handleFeedingSubmit,
    handleDeleteFeedingRecord,
    user,
  } = useDashboard();
  const { trackAction } = useAnalytics();

  // Compliance summary is only visible to FARM_MANAGER and above
  const canViewCompliance = user ? isRoleAtLeast(user.role, UserRole.FARM_MANAGER) : false;
  const canSaveSnapshot = user?.role === "FARM_MANAGER" || user?.role === "ADMIN";

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [feedingForm, setFeedingForm] = useState({
    product: "",
    actualQty: "",
    applicationDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Snapshot state
  const [saving, setSaving] = useState(false);
  const [snapshotInfo, setSnapshotInfo] = useState<SnapshotInfo | null>(null);
  const [snapshotEntries, setSnapshotEntries] = useState<FeedingSnapshotEntry[]>([]);

  const weekStr = selectedMonday.toISOString().split("T")[0];
  const isViewingSnapshot = !!snapshotInfo?.exists;

  // Check snapshot info when week changes
  useEffect(() => {
    async function checkSnapshot() {
      try {
        const res = await fetch(`/api/feeding-snapshot?weekStart=${weekStr}`);
        if (res.ok) {
          const info = await res.json();
          setSnapshotInfo(info);
          if (info.exists) {
            // Fetch snapshot entries for display
            const entriesRes = await fetch(`/api/feeding-snapshot?weekStart=${weekStr}&entries=true`);
            if (entriesRes.ok) {
              const data = await entriesRes.json();
              setSnapshotEntries(data.entries || []);
            }
          } else {
            setSnapshotEntries([]);
          }
        }
      } catch {
        // ignore
      }
    }
    checkSnapshot();
  }, [weekStr]);

  const farmPhases = selectedFarm ? phases.filter((p) => p.farm === selectedFarm) : [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhase) return;
    try {
      await handleFeedingSubmit(feedingForm, selectedPhase);

      // Track data entry
      trackAction("data_entry", {
        type: "feeding_record",
        farm: selectedFarm,
        product: feedingForm.product,
        qty: parseFloat(feedingForm.actualQty) || 0,
      });

      setFeedingForm({ product: "", actualQty: "", applicationDate: new Date().toISOString().split("T")[0], notes: "" });
      alert("Feeding record saved successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    }
  };

  const onDelete = async (id: number) => {
    try {
      await handleDeleteFeedingRecord(id);
      trackAction("data_delete", { type: "feeding_record", id });
    } catch {
      alert("Failed to delete record");
    }
  };

  // Build snapshot entries from current live data
  const buildSnapshotEntries = useCallback((): FeedingSnapshotEntry[] => {
    const entries: FeedingSnapshotEntry[] = [];
    const weekEnd = new Date(selectedMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    for (const phase of phases) {
      const ws = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      const phaseSops = nutriSop.filter((s) => s.cropCode === phase.cropCode && s.week === ws);
      const phaseRecords = feedingRecords.filter((r) => {
        const d = new Date(r.applicationDate);
        return r.farmPhaseId === phase.id && d >= selectedMonday && d <= weekEnd;
      });

      // Build actual quantities by product
      const actualByProduct: Record<string, { qty: number; rateHa: number }> = {};
      phaseRecords.forEach((r) => {
        if (!actualByProduct[r.product]) actualByProduct[r.product] = { qty: 0, rateHa: 0 };
        actualByProduct[r.product].qty += parseFloat(String(r.actualQty)) || 0;
        actualByProduct[r.product].rateHa += parseFloat(String(r.actualRateHa)) || 0;
      });

      // For each SOP product, create an entry
      for (const sop of phaseSops) {
        const expRate = parseFloat(String(sop.rateHa)) || 0;
        const expQty = expRate * areaHa;
        const actual = actualByProduct[sop.products] || { qty: 0, rateHa: 0 };
        const variance = expQty > 0 ? ((actual.qty - expQty) / expQty) * 100 : 0;

        entries.push({
          farmPhaseId: phase.id,
          phaseId: phase.phaseId,
          cropCode: phase.cropCode,
          farm: phase.farm,
          product: sop.products,
          expectedRateHa: expRate,
          expectedQty: expQty,
          actualQty: actual.qty,
          actualRateHa: actual.rateHa,
          variance: parseFloat(variance.toFixed(2)),
        });
      }

      // Also include products that were recorded but not in SOP
      for (const [product, actual] of Object.entries(actualByProduct)) {
        if (!phaseSops.some((s) => s.products === product)) {
          entries.push({
            farmPhaseId: phase.id,
            phaseId: phase.phaseId,
            cropCode: phase.cropCode,
            farm: phase.farm,
            product,
            expectedRateHa: 0,
            expectedQty: 0,
            actualQty: actual.qty,
            actualRateHa: actual.rateHa,
            variance: 0,
          });
        }
      }
    }

    return entries;
  }, [phases, nutriSop, feedingRecords, selectedMonday]);

  const handleSaveSnapshot = async () => {
    if (!confirm("Save feeding snapshot for all farms this week? This will freeze the current feeding compliance data.")) return;
    setSaving(true);
    try {
      const entries = buildSnapshotEntries();

      if (entries.length === 0) {
        alert("No feeding compliance entries to save for this week.");
        setSaving(false);
        return;
      }

      const saveRes = await fetch("/api/feeding-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStr,
          entries,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save snapshot");

      // Refresh snapshot info
      const infoRes = await fetch(`/api/feeding-snapshot?weekStart=${weekStr}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        setSnapshotInfo(info);
      }

      // Refresh snapshot entries
      const entriesRes = await fetch(`/api/feeding-snapshot?weekStart=${weekStr}&entries=true`);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setSnapshotEntries(data.entries || []);
      }

      alert("Feeding snapshot saved successfully!");
    } catch (error) {
      console.error("Failed to save feeding snapshot:", error);
      alert("Failed to save snapshot. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Helper: get snapshot compliance for a farm
  const getSnapshotFarmCompliance = (farmName: string): number | null => {
    const farmEntries = snapshotEntries.filter((e) => e.farm === farmName && e.expectedQty > 0);
    if (farmEntries.length === 0) return null;
    let totalCompliance = 0;
    farmEntries.forEach((e) => {
      totalCompliance += Math.max(0, 100 - Math.abs(e.variance));
    });
    return totalCompliance / farmEntries.length;
  };

  // Helper: get snapshot entries for a specific phase
  const getSnapshotPhaseEntries = (farmPhaseId: number): FeedingSnapshotEntry[] => {
    return snapshotEntries.filter((e) => e.farmPhaseId === farmPhaseId);
  };

  // ── Farm cards view ──────────────────────────────────────────────
  if (!selectedFarm) {
    return (
      <div className="space-y-6">
        <WeekSelector />

        {/* Snapshot controls */}
        {canSaveSnapshot && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSaveSnapshot}
              disabled={saving}
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Snapshot"}
            </button>
            {snapshotInfo?.exists && snapshotInfo.snapshotAt && (
              <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                Snapshot saved {new Date(snapshotInfo.snapshotAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {snapshotInfo.savedByName ? ` by ${snapshotInfo.savedByName}` : ""}
              </span>
            )}
          </div>
        )}

        {farmSummaries.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No farms found. Upload farm phases first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {farmSummaries.map((farm) => {
              const fp = phases.filter((p) => p.farm === farm.farm);

              // Use snapshot data if available
              if (isViewingSnapshot) {
                const snapshotCompliance = getSnapshotFarmCompliance(farm.farm);
                const farmSnapshotEntries = snapshotEntries.filter((e) => e.farm === farm.farm);
                const totalExpected = farmSnapshotEntries.filter((e) => e.expectedQty > 0).length;
                const totalActual = farmSnapshotEntries.filter((e) => e.actualQty > 0).length;

                return (
                  <button
                    key={farm.farm}
                    onClick={() => { setSelectedFarm(farm.farm); setSelectedPhase(null); }}
                    className="bg-white rounded-xl border border-gray-200 p-8 text-left hover:border-teal-300 hover:shadow-lg transition-all"
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
                        <p className="text-2xl font-bold text-blue-600">{totalExpected}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Expected</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${totalActual >= totalExpected ? "text-green-600" : "text-orange-500"}`}>{totalActual}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Actual</p>
                      </div>
                    </div>
                    {canViewCompliance && snapshotCompliance !== null && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600 font-medium">Compliance</span>
                          <span className={`text-lg font-bold ${snapshotCompliance >= 95 ? "text-green-600" : snapshotCompliance >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                            {snapshotCompliance.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${snapshotCompliance >= 95 ? "bg-green-500" : snapshotCompliance >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, snapshotCompliance)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                );
              }

              // Live computation
              const phasesNeeding = fp.filter((ph) => {
                const ws = calculateWeeksSinceSowing(ph.sowingDate, selectedMonday);
                return nutriSop.some((s) => s.cropCode === ph.cropCode && s.week === ws);
              }).length;

              let expected = 0;
              fp.forEach((ph) => {
                const ws = calculateWeeksSinceSowing(ph.sowingDate, selectedMonday);
                expected += nutriSop.filter((s) => s.cropCode === ph.cropCode && s.week === ws).length;
              });

              const weekEnd = new Date(selectedMonday);
              weekEnd.setDate(weekEnd.getDate() + 6);
              weekEnd.setHours(23, 59, 59, 999);
              const farmRecords = feedingRecords.filter((r) => {
                const d = new Date(r.applicationDate);
                return fp.some((p) => p.id === r.farmPhaseId) && d >= selectedMonday && d <= weekEnd;
              });
              const actual = farmRecords.length;

              // SOP compliance calculation
              let totalVariance = 0;
              let complianceCount = 0;
              fp.forEach((phase) => {
                const ws = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                const pr = farmRecords.filter((r) => r.farmPhaseId === phase.id);
                const areaHa = parseFloat(String(phase.areaHa)) || 0;
                const byProduct: Record<string, number> = {};
                pr.forEach((r) => {
                  byProduct[r.product] = (byProduct[r.product] || 0) + (parseFloat(String(r.actualQty)) || 0);
                });
                Object.entries(byProduct).forEach(([product, actualQty]) => {
                  const sop = nutriSop.find(
                    (s) => s.cropCode === phase.cropCode && s.products === product && s.week === ws
                  );
                  if (sop) {
                    const expectedQty = (parseFloat(String(sop.rateHa)) || 0) * areaHa;
                    if (expectedQty > 0) {
                      totalVariance += Math.max(0, 100 - Math.abs((actualQty - expectedQty) / expectedQty) * 100);
                      complianceCount++;
                    }
                  }
                });
              });
              const avgCompliance = complianceCount > 0 ? totalVariance / complianceCount : null;
              const hasRecords = farmRecords.length > 0;

              return (
                <button
                  key={farm.farm}
                  onClick={() => { setSelectedFarm(farm.farm); setSelectedPhase(null); }}
                  className="bg-white rounded-xl border border-gray-200 p-8 text-left hover:border-teal-300 hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{farm.farm}</h3>
                      <p className="text-sm text-gray-500">{farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{farm.totalAcreage.toFixed(2)} <span className="text-lg">Ha</span></p>
                  </div>
                  {phasesNeeding > 0 ? (
                    <p className="text-sm font-medium text-teal-600 mb-4">{phasesNeeding} phase{phasesNeeding !== 1 ? "s" : ""} need feeding this week</p>
                  ) : (
                    <p className="text-sm text-gray-400 mb-4">No feeding due this week</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-100">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{expected}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Expected</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${actual >= expected ? "text-green-600" : "text-orange-500"}`}>{actual}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Actual</p>
                    </div>
                  </div>

                  {/* SOP Compliance - visible to FARM_MANAGER+ only */}
                  {canViewCompliance && hasRecords && avgCompliance !== null ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 font-medium">Compliance</span>
                        <span className={`text-lg font-bold ${avgCompliance >= 95 ? "text-green-600" : avgCompliance >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                          {avgCompliance.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${avgCompliance >= 95 ? "bg-green-500" : avgCompliance >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, avgCompliance)}%` }}
                        />
                      </div>
                    </div>
                  ) : canViewCompliance && hasRecords ? (
                    <p className="text-xs text-gray-400 mt-4">No SOP match for records</p>
                  ) : expected > 0 ? (
                    <p className="text-xs text-orange-500 mt-4 font-medium">
                      {expected} feeding record{expected !== 1 ? "s" : ""} pending
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Phase selection view (farm selected, no phase yet) ────────────
  if (selectedFarm && !selectedPhase) {
    const weekStart = new Date(selectedMonday);
    const weekEnd = new Date(selectedMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return (
      <div className="space-y-6">
        <WeekSelector />
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setSelectedFarm(null)} className="text-sm text-teal-600 hover:text-teal-700">
              &larr; Back to farms
            </button>
            {snapshotInfo?.exists && snapshotInfo.snapshotAt && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Snapshot saved {new Date(snapshotInfo.snapshotAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
          <p className="text-green-600 font-medium mb-4">
            {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
          </p>

          <h3 className="text-sm font-medium text-gray-700 mb-2">Select Phase to Record Feeding</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Expected Products</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {farmPhases.map((phase) => {
                  const ws = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                  const expectedSop = nutriSop.filter(
                    (sop) => sop.cropCode === phase.cropCode && sop.week === ws
                  );
                  const hasExpected = expectedSop.length > 0;

                  const phaseRecordsThisWeek = feedingRecords.filter((r) => {
                    const d = new Date(r.applicationDate);
                    return r.farmPhaseId === phase.id && d >= weekStart && d <= weekEnd;
                  });

                  // Use snapshot compliance if available
                  let phaseCompliance: number | null = null;
                  if (isViewingSnapshot) {
                    const phaseSnap = getSnapshotPhaseEntries(phase.id).filter((e) => e.expectedQty > 0);
                    if (phaseSnap.length > 0) {
                      let total = 0;
                      phaseSnap.forEach((e) => { total += Math.max(0, 100 - Math.abs(e.variance)); });
                      phaseCompliance = total / phaseSnap.length;
                    }
                  } else {
                    // Live compliance calculation
                    const areaHa = parseFloat(String(phase.areaHa)) || 0;
                    const byProduct: Record<string, number> = {};
                    phaseRecordsThisWeek.forEach((r) => {
                      byProduct[r.product] = (byProduct[r.product] || 0) + (parseFloat(String(r.actualQty)) || 0);
                    });
                    let totalCompliance = 0;
                    let complianceCount = 0;
                    Object.entries(byProduct).forEach(([product, actualQty]) => {
                      const sopEntry = nutriSop.find(
                        (s) => s.cropCode === phase.cropCode && s.products === product && s.week === ws
                      );
                      if (sopEntry) {
                        const expectedQty = (parseFloat(String(sopEntry.rateHa)) || 0) * areaHa;
                        if (expectedQty > 0) {
                          const variance = Math.abs((actualQty - expectedQty) / expectedQty) * 100;
                          totalCompliance += Math.max(0, 100 - variance);
                          complianceCount++;
                        }
                      }
                    });
                    phaseCompliance = complianceCount > 0 ? totalCompliance / complianceCount : null;
                  }

                  // Compliance-based coloring only for FARM_MANAGER+
                  const phaseColorClass =
                    !canViewCompliance || phaseCompliance === null
                      ? "text-gray-700"
                      : phaseCompliance >= 95
                      ? "text-green-600 font-semibold"
                      : phaseCompliance >= 80
                      ? "text-yellow-600 font-semibold"
                      : "text-red-600 font-semibold";

                  return (
                    <tr key={phase.id} className="border-b border-gray-100">
                      <td className={`py-2 px-2 ${phaseColorClass}`}>{phase.phaseId}</td>
                      <td className="py-2 px-2">{phase.cropCode}</td>
                      <td className="py-2 px-2">{new Date(phase.sowingDate).toLocaleDateString("en-GB")}</td>
                      <td className="py-2 px-2">{parseFloat(String(phase.areaHa)).toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <span className={ws < 0 ? "text-gray-400" : "text-teal-600 font-medium"}>{ws}</span>
                      </td>
                      <td className="py-2 px-2">
                        {hasExpected ? (
                          <span className="text-sm text-gray-600">{expectedSop.map((s) => s.products).join(", ")}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => setSelectedPhase(phase)}
                          className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          Record {phaseRecordsThisWeek.length > 0 && `(${phaseRecordsThisWeek.length})`}
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
      ? nutriSop.filter((s) => s.cropCode === selectedPhase.cropCode && s.week === weeksSinceSowing)
      : [];

  const areaHa = selectedPhase ? parseFloat(String(selectedPhase.areaHa)) || 0 : 0;

  const phaseRecords = selectedPhase
    ? feedingRecords.filter((r) => r.farmPhaseId === selectedPhase.id)
    : [];

  const cropProducts = selectedPhase
    ? [...new Set(nutriSop.filter((s) => s.cropCode === selectedPhase.cropCode).map((s) => s.products))]
    : [];

  // Snapshot entries for this specific phase
  const phaseSnapshotEntries = selectedPhase ? getSnapshotPhaseEntries(selectedPhase.id) : [];

  return (
    <div className="space-y-6">
      <WeekSelector />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelectedPhase(null)} className="text-sm text-teal-600 hover:text-teal-700">
            &larr; Back to phases
          </button>
          {snapshotInfo?.exists && snapshotInfo.snapshotAt && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Snapshot saved {new Date(snapshotInfo.snapshotAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          {selectedPhase!.phaseId} - {selectedPhase!.cropCode}
        </h2>
        <p className="text-gray-600 mb-6">
          {selectedFarm} | {areaHa.toFixed(2)} Ha | Week {weeksSinceSowing}
        </p>

        {/* Expected SOP */}
        {expectedSop.length > 0 ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Expected (from SOP)</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Product</th>
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Rate/Ha</th>
                  <th className="text-left py-1 px-2 font-medium text-gray-600">Expected Qty</th>
                </tr>
              </thead>
              <tbody>
                {expectedSop.map((sop, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 px-2">{sop.products}</td>
                    <td className="py-1 px-2">{parseFloat(String(sop.rateHa)).toFixed(2)}</td>
                    <td className="py-1 px-2">{(parseFloat(String(sop.rateHa)) * areaHa).toFixed(2)}</td>
                  </tr>
                ))}
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
          <h3 className="text-sm font-medium text-gray-700 mb-3">Record Actual Feeding</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Product</label>
                <select
                  value={feedingForm.product}
                  onChange={(e) => setFeedingForm({ ...feedingForm, product: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="">Select product...</option>
                  {cropProducts.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Application Date</label>
                <input
                  type="date"
                  value={feedingForm.applicationDate}
                  onChange={(e) => setFeedingForm({ ...feedingForm, applicationDate: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Actual Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={feedingForm.actualQty}
                  onChange={(e) => setFeedingForm({ ...feedingForm, actualQty: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Calculated Rate/Ha</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-700">
                  {areaHa > 0 ? ((parseFloat(feedingForm.actualQty) || 0) / areaHa).toFixed(4) : "0.0000"}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                value={feedingForm.notes}
                onChange={(e) => setFeedingForm({ ...feedingForm, notes: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={2}
              />
            </div>
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-teal-700">
              Save Record
            </button>
          </form>
        </div>

        {/* Snapshot Compliance Summary - shown when snapshot exists */}
        {isViewingSnapshot && canViewCompliance && phaseSnapshotEntries.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-3">Compliance Summary (Snapshot)</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-blue-200">
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Product</th>
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Rate/Ha</th>
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Rate/Ha</th>
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Qty</th>
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Qty</th>
                  <th className="text-left py-2 px-2 font-medium text-blue-700">Variance</th>
                </tr>
              </thead>
              <tbody>
                {phaseSnapshotEntries.map((entry, idx) => (
                  <tr key={idx} className="border-b border-blue-100">
                    <td className="py-2 px-2 font-medium">{entry.product}</td>
                    <td className="py-2 px-2">{entry.expectedRateHa.toFixed(2)}</td>
                    <td className="py-2 px-2">{entry.actualRateHa.toFixed(2)}</td>
                    <td className="py-2 px-2">{entry.expectedQty.toFixed(2)}</td>
                    <td className="py-2 px-2">{entry.actualQty.toFixed(2)}</td>
                    <td className={`py-2 px-2 font-medium ${entry.variance > 5 ? "text-red-600" : entry.variance < -5 ? "text-orange-600" : "text-green-600"}`}>
                      {entry.variance > 0 ? "+" : ""}{entry.variance.toFixed(1)}%
                      {entry.variance > 5 ? " (Over)" : entry.variance < -5 ? " (Under)" : " (OK)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Live Compliance + Records */}
        {phaseRecords.length > 0 && (() => {
          const expectedProducts = nutriSop.filter((s) => s.cropCode === selectedPhase!.cropCode);
          const byProduct: Record<string, { totalQty: number; totalRateHa: number }> = {};
          phaseRecords.forEach((r) => {
            if (!byProduct[r.product]) byProduct[r.product] = { totalQty: 0, totalRateHa: 0 };
            byProduct[r.product].totalQty += parseFloat(String(r.actualQty)) || 0;
            byProduct[r.product].totalRateHa += parseFloat(String(r.actualRateHa)) || 0;
          });

          return (
            <>
              {/* Live Compliance Summary - visible to FARM_MANAGER+ only, hidden when snapshot shown */}
              {canViewCompliance && !isViewingSnapshot && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800 mb-3">Compliance Summary</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-200">
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Product</th>
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Rate/Ha</th>
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Rate/Ha</th>
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Qty</th>
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Qty</th>
                        <th className="text-left py-2 px-2 font-medium text-blue-700">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byProduct).map(([product, data]) => {
                        // Find the SOP entry closest to the current week for this product
                        const productSops = expectedProducts.filter((s) => s.products === product);
                        const sop = productSops.length > 0
                          ? productSops.reduce((closest, current) => {
                              const closestDiff = Math.abs((closest.week ?? 0) - (weeksSinceSowing ?? 0));
                              const currentDiff = Math.abs((current.week ?? 0) - (weeksSinceSowing ?? 0));
                              return currentDiff < closestDiff ? current : closest;
                            })
                          : null;
                        const expRate = sop ? parseFloat(String(sop.rateHa)) : 0;
                        const expQty = expRate * areaHa;
                        const variance = expQty > 0 ? ((data.totalQty - expQty) / expQty) * 100 : 0;
                        return (
                          <tr key={product} className="border-b border-blue-100">
                            <td className="py-2 px-2 font-medium">{product}</td>
                            <td className="py-2 px-2">{expRate.toFixed(2)}</td>
                            <td className="py-2 px-2">{data.totalRateHa.toFixed(2)}</td>
                            <td className="py-2 px-2">{expQty.toFixed(2)}</td>
                            <td className="py-2 px-2">{data.totalQty.toFixed(2)}</td>
                            <td className={`py-2 px-2 font-medium ${variance > 5 ? "text-red-600" : variance < -5 ? "text-orange-600" : "text-green-600"}`}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                              {variance > 5 ? " (Over)" : variance < -5 ? " (Under)" : " (OK)"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Feeding Records</h3>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Product</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Rate/Ha</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Qty</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Notes</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseRecords.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="py-2 px-2">{new Date(r.applicationDate).toLocaleDateString("en-GB")}</td>
                        <td className="py-2 px-2">{r.product}</td>
                        <td className="py-2 px-2">{parseFloat(String(r.actualRateHa)).toFixed(2)}</td>
                        <td className="py-2 px-2">{parseFloat(String(r.actualQty)).toFixed(2)}</td>
                        <td className="py-2 px-2 text-gray-500">{r.notes || "-"}</td>
                        <td className="py-2 px-2">
                          <button onClick={() => onDelete(r.id)} className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
