"use client";

import { useState } from "react";
import WeekSelector from "../WeekSelector";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  type Phase,
} from "../DashboardContext";

export default function FeedingTab() {
  const {
    phases,
    nutriSop,
    feedingRecords,
    selectedMonday,
    farmSummaries,
    handleFeedingSubmit,
    handleDeleteFeedingRecord,
  } = useDashboard();

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | "">("");
  const [feedingForm, setFeedingForm] = useState({
    product: "",
    actualQty: "",
    applicationDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const selectedPhase: Phase | undefined =
    selectedPhaseId !== "" ? phases.find((p) => p.id === selectedPhaseId) : undefined;

  const farmPhases = selectedFarm ? phases.filter((p) => p.farm === selectedFarm) : [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhase) return;
    try {
      await handleFeedingSubmit(feedingForm, selectedPhase);
      setFeedingForm({ product: "", actualQty: "", applicationDate: new Date().toISOString().split("T")[0], notes: "" });
      alert("Feeding record saved successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save record");
    }
  };

  const onDelete = async (id: number) => {
    try { await handleDeleteFeedingRecord(id); } catch { alert("Failed to delete record"); }
  };

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
                  onClick={() => { setSelectedFarm(farm.farm); setSelectedPhaseId(""); }}
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

                  {/* SOP Compliance */}
                  {hasRecords && avgCompliance !== null ? (
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
                  ) : hasRecords ? (
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

  // ── Farm selected → recording form with phase dropdown ───────────
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

  return (
    <div className="space-y-6">
      <WeekSelector />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <button onClick={() => setSelectedFarm(null)} className="text-sm text-teal-600 hover:text-teal-700 mb-4">
          &larr; Back to farms
        </button>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{selectedFarm}</h2>
        <p className="text-green-600 font-medium mb-6">
          {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
        </p>

        {/* Phase dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Phase</label>
          <select
            value={selectedPhaseId}
            onChange={(e) => setSelectedPhaseId(e.target.value ? Number(e.target.value) : "")}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Choose a phase...</option>
            {farmPhases.map((p) => {
              const ws = calculateWeeksSinceSowing(p.sowingDate, selectedMonday);
              return (
                <option key={p.id} value={p.id}>
                  {p.phaseId} — {p.cropCode} ({parseFloat(String(p.areaHa)).toFixed(2)} Ha, Week {ws})
                </option>
              );
            })}
          </select>
        </div>

        {selectedPhase && (
          <>
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

            {/* Compliance + Records */}
            {phaseRecords.length > 0 && (() => {
              const expectedProducts = nutriSop.filter((s) => s.cropCode === selectedPhase.cropCode);
              const byProduct: Record<string, { totalQty: number; totalRateHa: number }> = {};
              phaseRecords.forEach((r) => {
                if (!byProduct[r.product]) byProduct[r.product] = { totalQty: 0, totalRateHa: 0 };
                byProduct[r.product].totalQty += parseFloat(String(r.actualQty)) || 0;
                byProduct[r.product].totalRateHa += parseFloat(String(r.actualRateHa)) || 0;
              });

              return (
                <>
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
                          const sop = expectedProducts.find((s) => s.products === product);
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
          </>
        )}
      </div>
    </div>
  );
}
