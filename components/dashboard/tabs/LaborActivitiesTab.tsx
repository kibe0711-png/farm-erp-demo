"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/DataTable";
import WeekSelector from "../WeekSelector";
import LaborGanttChart, { type GanttActivity } from "./LaborGanttChart";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  ACTIVITY_COLUMNS,
} from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";
import jsPDF from "jspdf";

interface Override {
  id: number;
  farmPhaseId: number;
  sopId: number;
  sopType: string;
  action: string;
  weekStart: string;
}

export default function LaborActivitiesTab() {
  const {
    phases,
    laborSop,
    farms,
    loading,
    selectedMonday,
    selectedWeek,
    farmSummaries,
    user,
  } = useDashboard();

  const canEditGantt = !!user && hasPermission(user.role, Permission.EDIT_GANTT);

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);

  const weekStr = selectedMonday.toISOString().split("T")[0];

  const farmPhases = selectedFarm
    ? phases
        .filter((p) => p.farm === selectedFarm)
        .map((phase) => ({
          ...phase,
          weeksSinceSowing: calculateWeeksSinceSowing(phase.sowingDate, selectedMonday),
        }))
    : [];

  const farmPhaseIds = farmPhases.map((p) => p.id);

  // Fetch overrides when farm or week changes
  const fetchOverrides = useCallback(async () => {
    if (farmPhaseIds.length === 0) {
      setOverrides([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/phase-overrides?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}&sopType=labor`
      );
      if (res.ok) {
        setOverrides(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch overrides:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarm, weekStr, farmPhaseIds.join(",")]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Build Gantt activities with overrides applied
  const ganttActivities: GanttActivity[] = (() => {
    // Start with default SOP-matched activities
    const defaultActivities: GanttActivity[] = farmPhases.flatMap((phase) => {
      const weekNum = phase.weeksSinceSowing;
      if (weekNum < 0) return [];
      const matchingSop = laborSop.filter(
        (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
      );
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      return matchingSop.map((sop) => ({
        key: `${phase.id}-${sop.id}`,
        label: `${phase.phaseId} W${weekNum} - ${sop.task}`,
        farmPhaseId: phase.id,
        sopId: sop.id,
        totalMandays: sop.noOfCasuals * sop.noOfDays * areaHa,
        cropCode: phase.cropCode,
      }));
    });

    // Apply "remove" overrides — filter out activities with remove overrides
    const removeSet = new Set(
      overrides
        .filter((o) => o.action === "remove")
        .map((o) => `${o.farmPhaseId}-${o.sopId}`)
    );
    const filtered = defaultActivities.filter((a) => !removeSet.has(a.key));

    // Apply "add" overrides — add activities from SOPs not normally matching
    const addOverrides = overrides.filter((o) => o.action === "add");
    const existingKeys = new Set(filtered.map((a) => a.key));

    addOverrides.forEach((o) => {
      const key = `${o.farmPhaseId}-${o.sopId}`;
      if (existingKeys.has(key)) return;

      const sop = laborSop.find((s) => s.id === o.sopId);
      const phase = farmPhases.find((p) => p.id === o.farmPhaseId);
      if (!sop || !phase) return;

      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      filtered.push({
        key,
        label: `${phase.phaseId} W${sop.week} - ${sop.task}`,
        farmPhaseId: phase.id,
        sopId: sop.id,
        totalMandays: sop.noOfCasuals * sop.noOfDays * areaHa,
        cropCode: phase.cropCode,
      });
    });

    // Sort by farmPhaseId to keep activities grouped by phase
    const phaseOrder = new Map(farmPhases.map((p, idx) => [p.id, idx]));
    filtered.sort((a, b) => {
      const orderA = phaseOrder.get(a.farmPhaseId) ?? 999;
      const orderB = phaseOrder.get(b.farmPhaseId) ?? 999;
      return orderA - orderB;
    });

    return filtered;
  })();

  // Available SOPs for adding (those not already in the Gantt)
  const availableToAdd = (() => {
    const currentKeys = new Set(ganttActivities.map((a) => a.key));
    const available: { sopId: number; farmPhaseId: number; label: string }[] = [];

    farmPhases.forEach((phase) => {
      // Get all SOPs for this crop (any week), not just current week
      const allSopsForCrop = laborSop.filter((sop) => sop.cropCode === phase.cropCode);
      allSopsForCrop.forEach((sop) => {
        const key = `${phase.id}-${sop.id}`;
        if (!currentKeys.has(key)) {
          available.push({
            sopId: sop.id,
            farmPhaseId: phase.id,
            label: `${phase.phaseId} W${sop.week} - ${sop.task}`,
          });
        }
      });
    });

    return available;
  })();

  const handleRemoveActivity = async (activityKey: string) => {
    const [farmPhaseId, sopId] = activityKey.split("-").map(Number);
    try {
      await fetch("/api/phase-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmPhaseId,
          sopId,
          sopType: "labor",
          action: "remove",
          weekStart: weekStr,
        }),
      });
      fetchOverrides();
    } catch (error) {
      console.error("Failed to remove activity:", error);
    }
  };

  const handleAddActivity = async (sopId: number, farmPhaseId: number) => {
    try {
      await fetch("/api/phase-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmPhaseId,
          sopId,
          sopType: "labor",
          action: "add",
          weekStart: weekStr,
        }),
      });
      fetchOverrides();
    } catch (error) {
      console.error("Failed to add activity:", error);
    }
  };

  const handleUndoOverride = async (activityKey: string) => {
    const [farmPhaseId, sopId] = activityKey.split("-").map(Number);
    try {
      await fetch(
        `/api/phase-overrides?farmPhaseId=${farmPhaseId}&sopId=${sopId}&sopType=labor&weekStart=${weekStr}`,
        { method: "DELETE" }
      );
      fetchOverrides();
    } catch (error) {
      console.error("Failed to undo override:", error);
    }
  };

  // Check for per-farm labor rate override
  const farmOverride = selectedFarm ? farms.find((f) => f.name === selectedFarm) : null;
  const overrideRate = farmOverride?.laborRatePerDay != null
    ? parseFloat(String(farmOverride.laborRatePerDay))
    : null;

  const laborActivities = farmPhases.flatMap((phase) => {
    const weekNum = phase.weeksSinceSowing;
    if (weekNum < 0) return [];
    const matchingSop = laborSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
    );
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    return matchingSop.map((sop) => {
      const costPerDay = (overrideRate != null && overrideRate > 0)
        ? overrideRate
        : parseFloat(String(sop.costPerCasualDay)) || 0;
      const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
      const totalCost = totalMandays * costPerDay;
      return {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa: areaHa.toFixed(2),
        week: weekNum,
        task: sop.task,
        casuals: sop.noOfCasuals,
        days: sop.noOfDays,
        totalMandays: totalMandays.toFixed(1),
        costPerDay: costPerDay.toFixed(0),
        totalCost: totalCost.toLocaleString(),
      };
    });
  });

  const downloadPdf = () => {
    if (laborActivities.length === 0 || !selectedFarm) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 12) {
        doc.addPage();
        y = margin;
      }
    };

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text(`${selectedFarm} — Labor Activities`, margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); // gray-500
    const farmAcreage = farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2) ?? "-";
    doc.text(`Week ${selectedWeek} | ${farmAcreage} Ha total`, margin, y);
    y += 8;

    // Table columns
    const cols = [margin, margin + 30, margin + 50, margin + 68, margin + 82, margin + 110, margin + 130, margin + 152, margin + 180, margin + 210];
    const headers = ["Phase", "Crop", "Area (Ha)", "Week", "Task", "Casuals", "Days", "Mandays", "Cost/Day", "Total Cost"];

    // Table header row
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    headers.forEach((h, i) => doc.text(h, cols[i] + 1, y));
    y += 5;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(7);

    for (const row of laborActivities) {
      checkPage(5);
      doc.text(String(row.phaseId), cols[0] + 1, y);
      doc.text(String(row.cropCode), cols[1] + 1, y);
      doc.text(String(row.areaHa), cols[2] + 1, y);
      doc.text(String(row.week), cols[3] + 1, y);
      doc.text(String(row.task), cols[4] + 1, y);
      doc.text(String(row.casuals), cols[5] + 1, y);
      doc.text(String(row.days), cols[6] + 1, y);
      doc.text(String(row.totalMandays), cols[7] + 1, y);
      doc.text(String(row.costPerDay), cols[8] + 1, y);
      doc.text(String(row.totalCost), cols[9] + 1, y);
      y += 4.5;
    }

    // Total row
    const grandTotal = laborActivities.reduce(
      (sum, r) => sum + parseFloat(String(r.totalCost).replace(/,/g, "") || "0"),
      0
    );
    y += 1;
    doc.setFillColor(239, 246, 255); // blue-50
    doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Total", cols[0] + 1, y);
    doc.text(grandTotal.toLocaleString() + " RWF", cols[9] + 1, y);

    doc.save(`LaborActivities-${selectedFarm}-W${selectedWeek}.pdf`);
  };

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
                  className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{farm.farm}</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {farm.totalAcreage.toFixed(2)} Ha
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                  </p>
                  {farm.totalLaborCost > 0 ? (
                    <p className="text-lg font-semibold text-blue-600 mt-2">
                      {farm.totalLaborCost.toLocaleString()} RWF
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">No labor activities this week</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={() => setSelectedFarm(null)}
                className="text-sm text-blue-600 hover:text-blue-700 mb-2"
              >
                &larr; Back to farms
              </button>
              <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
              <p className="text-green-600 font-medium">
                {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha
                total
              </p>
            </div>
            {laborActivities.length > 0 && (
              <button
                onClick={downloadPdf}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
              >
                Download PDF
              </button>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Weekly Schedule — Week {selectedWeek}
            </h3>
            <LaborGanttChart
              activities={ganttActivities}
              weekStartDate={selectedMonday}
              farmPhaseIds={farmPhaseIds}
              canEdit={canEditGantt}
              onRemoveActivity={handleRemoveActivity}
              onAddActivity={handleAddActivity}
              onUndoOverride={handleUndoOverride}
              availableActivities={availableToAdd}
              overrides={overrides}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Labor Activities for Week {selectedWeek}
            </h3>
            {laborActivities.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">
                No labor activities for the current week.
              </p>
            ) : (
              <DataTable data={laborActivities} columns={ACTIVITY_COLUMNS} loading={loading} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
