"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import WeekSelector from "../WeekSelector";
import LaborGanttChart, { type GanttActivity } from "./LaborGanttChart";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  ACTIVITY_COLUMNS,
} from "../DashboardContext";

export default function LaborActivitiesTab() {
  const {
    phases,
    laborSop,
    farms,
    loading,
    selectedMonday,
    selectedWeek,
    farmSummaries,
  } = useDashboard();

  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  const farmPhases = selectedFarm
    ? phases
        .filter((p) => p.farm === selectedFarm)
        .map((phase) => ({
          ...phase,
          weeksSinceSowing: calculateWeeksSinceSowing(phase.sowingDate, selectedMonday),
        }))
    : [];

  // Build Gantt activities with SOP ID and farmPhaseId
  const ganttActivities: GanttActivity[] = farmPhases.flatMap((phase) => {
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
    }));
  });

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

  const farmPhaseIds = farmPhases.map((p) => p.id);

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
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Weekly Schedule — Week {selectedWeek}
            </h3>
            <LaborGanttChart
              activities={ganttActivities}
              weekStartDate={selectedMonday}
              farmPhaseIds={farmPhaseIds}
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
