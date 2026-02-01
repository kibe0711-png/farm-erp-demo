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
