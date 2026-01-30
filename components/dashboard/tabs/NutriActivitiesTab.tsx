"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/DataTable";
import WeekSelector from "../WeekSelector";
import NutriGanttChart, { type NutriGanttActivity } from "./NutriGanttChart";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  NUTRI_ACTIVITY_COLUMNS,
} from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";

interface Override {
  id: number;
  farmPhaseId: number;
  sopId: number;
  sopType: string;
  action: string;
  weekStart: string;
}

export default function NutriActivitiesTab() {
  const {
    phases,
    nutriSop,
    loading,
    selectedMonday,
    selectedWeek,
    farmSummaries,
    user,
  } = useDashboard();

  const canEditGantt = !!user && hasPermission(user.role, Permission.EDIT_GANTT);

  const [selectedNutriFarm, setSelectedNutriFarm] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);

  const weekStr = selectedMonday.toISOString().split("T")[0];

  const nutriFarmPhases = selectedNutriFarm
    ? phases
        .filter((p) => p.farm === selectedNutriFarm)
        .map((phase) => ({
          ...phase,
          weeksSinceSowing: calculateWeeksSinceSowing(phase.sowingDate, selectedMonday),
        }))
    : [];

  const farmPhaseIds = nutriFarmPhases.map((p) => p.id);

  // Fetch overrides when farm or week changes
  const fetchOverrides = useCallback(async () => {
    if (farmPhaseIds.length === 0) {
      setOverrides([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/phase-overrides?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}&sopType=nutri`
      );
      if (res.ok) {
        setOverrides(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch overrides:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNutriFarm, weekStr, farmPhaseIds.join(",")]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Build Gantt activities with overrides applied
  const ganttActivities: NutriGanttActivity[] = (() => {
    const defaultActivities: NutriGanttActivity[] = nutriFarmPhases.flatMap((phase) => {
      const weekNum = phase.weeksSinceSowing;
      if (weekNum < 0) return [];
      const matchingSop = nutriSop.filter(
        (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
      );
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      return matchingSop.map((sop) => ({
        key: `${phase.id}-${sop.id}`,
        label: `${phase.phaseId} W${weekNum} - ${sop.products}`,
        farmPhaseId: phase.id,
        sopId: sop.id,
        totalQuantity: (parseFloat(String(sop.rateHa)) || 0) * areaHa,
        cropCode: phase.cropCode,
      }));
    });

    // Apply "remove" overrides
    const removeSet = new Set(
      overrides
        .filter((o) => o.action === "remove")
        .map((o) => `${o.farmPhaseId}-${o.sopId}`)
    );
    const filtered = defaultActivities.filter((a) => !removeSet.has(a.key));

    // Apply "add" overrides
    const addOverrides = overrides.filter((o) => o.action === "add");
    const existingKeys = new Set(filtered.map((a) => a.key));

    addOverrides.forEach((o) => {
      const key = `${o.farmPhaseId}-${o.sopId}`;
      if (existingKeys.has(key)) return;

      const sop = nutriSop.find((s) => s.id === o.sopId);
      const phase = nutriFarmPhases.find((p) => p.id === o.farmPhaseId);
      if (!sop || !phase) return;

      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      filtered.push({
        key,
        label: `${phase.phaseId} W${sop.week} - ${sop.products}`,
        farmPhaseId: phase.id,
        sopId: sop.id,
        totalQuantity: (parseFloat(String(sop.rateHa)) || 0) * areaHa,
        cropCode: phase.cropCode,
      });
    });

    return filtered;
  })();

  // Available SOPs for adding (those not already in the Gantt)
  const availableToAdd = (() => {
    const currentKeys = new Set(ganttActivities.map((a) => a.key));
    const available: { sopId: number; farmPhaseId: number; label: string }[] = [];

    nutriFarmPhases.forEach((phase) => {
      const allSopsForCrop = nutriSop.filter((sop) => sop.cropCode === phase.cropCode);
      allSopsForCrop.forEach((sop) => {
        const key = `${phase.id}-${sop.id}`;
        if (!currentKeys.has(key)) {
          available.push({
            sopId: sop.id,
            farmPhaseId: phase.id,
            label: `${phase.phaseId} W${sop.week} - ${sop.products}`,
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
          sopType: "nutri",
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
          sopType: "nutri",
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
        `/api/phase-overrides?farmPhaseId=${farmPhaseId}&sopId=${sopId}&sopType=nutri&weekStart=${weekStr}`,
        { method: "DELETE" }
      );
      fetchOverrides();
    } catch (error) {
      console.error("Failed to undo override:", error);
    }
  };

  const nutriActivities = nutriFarmPhases.flatMap((phase) => {
    const weekNum = phase.weeksSinceSowing;
    if (weekNum < 0) return [];
    const matchingSop = nutriSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
    );
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    return matchingSop.map((sop) => {
      const rateHa = parseFloat(String(sop.rateHa)) || 0;
      const unitPrice = parseFloat(String(sop.unitPriceRwf)) || 0;
      const costPerHa = parseFloat(String(sop.cost)) || 0;
      const totalQuantity = rateHa * areaHa;
      const totalCost = costPerHa * areaHa;
      return {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa: areaHa.toFixed(2),
        week: weekNum,
        product: sop.products,
        activeIngredient: sop.activeIngredient,
        rateHa: rateHa.toFixed(2),
        totalQuantity: totalQuantity.toFixed(2),
        unitPrice: unitPrice.toLocaleString(),
        totalCost: totalCost.toLocaleString(),
      };
    });
  });

  return (
    <div className="space-y-6">
      <WeekSelector />

      {!selectedNutriFarm ? (
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
                  onClick={() => setSelectedNutriFarm(farm.farm)}
                  className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-green-300 hover:shadow-md transition-all"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{farm.farm}</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {farm.totalAcreage.toFixed(2)} Ha
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                  </p>
                  {farm.totalNutriCost > 0 ? (
                    <p className="text-lg font-semibold text-purple-600 mt-2">
                      {farm.totalNutriCost.toLocaleString()} RWF
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">
                      No nutrition activities this week
                    </p>
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
                onClick={() => setSelectedNutriFarm(null)}
                className="text-sm text-purple-600 hover:text-purple-700 mb-2"
              >
                &larr; Back to farms
              </button>
              <h2 className="text-xl font-semibold text-gray-900">{selectedNutriFarm}</h2>
              <p className="text-green-600 font-medium">
                {farmSummaries
                  .find((f) => f.farm === selectedNutriFarm)
                  ?.totalAcreage.toFixed(2)}{" "}
                Ha total
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Weekly Schedule — Week {selectedWeek}
            </h3>
            <NutriGanttChart
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
              Nutrition Activities for Week {selectedWeek}
            </h3>
            {nutriActivities.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">
                No nutrition activities for the current week.
              </p>
            ) : (
              <DataTable
                data={nutriActivities}
                columns={NUTRI_ACTIVITY_COLUMNS}
                loading={loading}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
