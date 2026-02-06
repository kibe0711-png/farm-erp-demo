"use client";

import { useState, useEffect } from "react";
import WeekSelector from "../WeekSelector";
import HarvestGanttChart, { type HarvestPhaseRow } from "./HarvestGanttChart";
import { useDashboard } from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";
import jsPDF from "jspdf";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ApiEntry {
  farmPhaseId: number;
  dayOfWeek: number;
  pledgeKg?: string | number | null;
}

export default function HarvestingTab() {
  const {
    phases,
    selectedMonday,
    selectedWeek,
    farmSummaries,
    user,
  } = useDashboard();

  const canEditGantt = !!user && hasPermission(user.role, Permission.EDIT_GANTT);

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  const farmPhases = selectedFarm
    ? phases.filter((p) => p.farm === selectedFarm)
    : [];

  const farmPhaseIds = farmPhases.map((p) => p.id);

  const ganttPhases: HarvestPhaseRow[] = farmPhases.map((p) => ({
    farmPhaseId: p.id,
    cropCode: p.cropCode,
    phaseId: p.phaseId,
  }));

  // Master download function for all farms
  const downloadAllFarmsPDF = async () => {
    if (phases.length === 0) return;

    const weekStr = selectedMonday.toISOString().split("T")[0];

    // Fetch all schedules
    const allPhaseIds = phases.map((p) => p.id);
    const res = await fetch(
      `/api/harvest-schedule?farmPhaseIds=${allPhaseIds.join(",")}&weekStart=${weekStr}`
    );

    if (!res.ok) {
      console.error("Failed to fetch harvest schedules");
      return;
    }

    const entries: ApiEntry[] = await res.json();

    // Build schedule map
    const scheduleMap = new Map<number, Map<number, number | null>>();
    entries.forEach((e) => {
      if (!scheduleMap.has(e.farmPhaseId)) {
        scheduleMap.set(e.farmPhaseId, new Map());
      }
      const kg = e.pledgeKg != null ? Number(e.pledgeKg) : null;
      scheduleMap.get(e.farmPhaseId)!.set(e.dayOfWeek, isNaN(kg as number) ? null : kg);
    });

    // Calculate total kg per phase and filter to only phases with pledges > 0
    const phaseKgMap = new Map<number, number>();
    entries.forEach((e) => {
      const kg = e.pledgeKg != null ? Number(e.pledgeKg) : 0;
      if (!isNaN(kg)) {
        phaseKgMap.set(e.farmPhaseId, (phaseKgMap.get(e.farmPhaseId) || 0) + kg);
      }
    });

    const phasesWithPledges = phases.filter((p) => (phaseKgMap.get(p.id) || 0) > 0);

    if (phasesWithPledges.length === 0) {
      alert("No phases with pledges for this week");
      return;
    }

    // Group phases by farm, then by crop code
    const farmGroups = new Map<string, Map<string, typeof phasesWithPledges>>();
    phasesWithPledges.forEach((phase) => {
      if (!farmGroups.has(phase.farm)) {
        farmGroups.set(phase.farm, new Map());
      }
      const cropGroups = farmGroups.get(phase.farm)!;
      if (!cropGroups.has(phase.cropCode)) {
        cropGroups.set(phase.cropCode, []);
      }
      cropGroups.get(phase.cropCode)!.push(phase);
    });

    // Generate PDF
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;
    let isFirstPage = true;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 12) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(`Master Farmer Pledge — All Farms`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Week ${selectedWeek} | Phases with Pledges Only`, margin, y);
    y += 10;

    // Iterate through farms
    for (const [farmName, cropGroups] of Array.from(farmGroups.entries()).sort()) {
      const farmPhases = phasesWithPledges.filter((p) => p.farm === farmName);

      // Calculate total kg for this farm
      let farmTotalKg = 0;
      farmPhases.forEach((phase) => {
        const days = scheduleMap.get(phase.id);
        if (days) {
          days.forEach((kg) => { farmTotalKg += kg ?? 0; });
        }
      });

      // Farm header
      if (!isFirstPage) {
        checkPage(15);
      }
      isFirstPage = false;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55); // gray-800
      doc.text(`${farmName} — ${farmTotalKg.toLocaleString()} kg`, margin, y);
      y += 6;

      // Iterate through crop codes within this farm
      for (const [cropCode, cropPhases] of Array.from(cropGroups.entries()).sort()) {
        checkPage(30);

        // Crop code subheader
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text(`${cropCode}`, margin + 2, y);
        y += 5;

        // Table columns: Phase | Mon-Sun | Days | Kg
        const colWidths = [50, 25, 25, 25, 25, 25, 25, 25, 22, 30];
        const cols: number[] = [];
        let cx = margin;
        for (const w of colWidths) { cols.push(cx); cx += w; }

        const headers = ["Phase", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Days", "Kg"];

        // Table header row
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y - 3.5, contentW, 5.5, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 65, 81);
        headers.forEach((h, i) => {
          if (i === 0) doc.text(h, cols[i] + 1, y);
          else doc.text(h, cols[i] + colWidths[i] / 2, y, { align: "center" });
        });
        y += 5;

        // Data rows for this crop
        doc.setFont("helvetica", "normal");
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(7);

        let cropTotalKg = 0;
        const cropDayKgs: number[] = new Array(7).fill(0);
        const cropDayCounts: number[] = new Array(7).fill(0);

        for (const phase of cropPhases) {
          checkPage(5);
          const days = scheduleMap.get(phase.id) || new Map();
          let rowKg = 0;
          days.forEach((kg) => { rowKg += kg ?? 0; });

          doc.text(phase.phaseId, cols[0] + 1, y);

          DAY_LABELS.forEach((_, dayIdx) => {
            const kg = days.get(dayIdx);
            const cellText = days.has(dayIdx) ? (kg != null ? String(kg) : "✓") : "-";
            doc.text(cellText, cols[dayIdx + 1] + colWidths[dayIdx + 1] / 2, y, { align: "center" });

            if (days.has(dayIdx)) {
              cropDayCounts[dayIdx]++;
              cropDayKgs[dayIdx] += kg ?? 0;
            }
          });

          doc.text(String(days.size), cols[8] + colWidths[8] / 2, y, { align: "center" });
          doc.text(rowKg > 0 ? rowKg.toLocaleString() : "-", cols[9] + colWidths[9] / 2, y, { align: "center" });
          cropTotalKg += rowKg;
          y += 4.5;
        }

        // Crop subtotal row
        y += 1;
        doc.setFillColor(255, 251, 235); // amber-50
        doc.rect(margin, y - 3.5, contentW, 5.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text(`${cropCode} Total`, cols[0] + 1, y);

        cropDayCounts.forEach((count, idx) => {
          let cellText = String(count);
          if (cropDayKgs[idx] > 0) cellText += ` (${cropDayKgs[idx].toLocaleString()} kg)`;
          doc.text(cellText, cols[idx + 1] + colWidths[idx + 1] / 2, y, { align: "center" });
        });

        const totalDays = cropDayCounts.reduce((a, b) => a + b, 0);
        doc.text(String(totalDays), cols[8] + colWidths[8] / 2, y, { align: "center" });
        doc.setTextColor(180, 83, 9);
        doc.text(cropTotalKg > 0 ? `${cropTotalKg.toLocaleString()} kg` : "-", cols[9] + colWidths[9] / 2, y, { align: "center" });
        y += 8;
      }

      y += 3; // Space between farms
    }

    doc.save(`MasterFarmerPledge-AllFarms-W${selectedWeek}.pdf`);
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
          <>
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={downloadAllFarmsPDF}
                className="bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-800"
              >
                Download All Farms PDF
              </button>
            </div>

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
          </>
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

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Farmer Pledge &mdash; Week {selectedWeek}
          </h3>
          <HarvestGanttChart
            phases={ganttPhases}
            weekStartDate={selectedMonday}
            farmPhaseIds={farmPhaseIds}
            canEdit={canEditGantt}
            farmName={selectedFarm}
            weekNumber={selectedWeek}
            totalHa={farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2) ?? "-"}
          />
        </div>
      </div>
    </div>
  );
}
