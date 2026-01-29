"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import WeekSelector from "../WeekSelector";
import {
  useDashboard,
  calculateWeeksSinceSowing,
  NUTRI_ACTIVITY_COLUMNS,
} from "../DashboardContext";

export default function NutriActivitiesTab() {
  const {
    phases,
    nutriSop,
    loading,
    selectedMonday,
    selectedWeek,
    farmSummaries,
  } = useDashboard();

  const [selectedNutriFarm, setSelectedNutriFarm] = useState<string | null>(null);

  const nutriFarmPhases = selectedNutriFarm
    ? phases
        .filter((p) => p.farm === selectedNutriFarm)
        .map((phase) => ({
          ...phase,
          weeksSinceSowing: calculateWeeksSinceSowing(phase.sowingDate, selectedMonday),
        }))
    : [];

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
            <h3 className="text-sm font-medium text-gray-700 mb-2">Phases</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                  </tr>
                </thead>
                <tbody>
                  {nutriFarmPhases.map((phase) => (
                    <tr key={phase.id} className="border-b border-gray-100">
                      <td className="py-2 px-2">{phase.phaseId}</td>
                      <td className="py-2 px-2">{phase.cropCode}</td>
                      <td className="py-2 px-2">
                        {new Date(phase.sowingDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-2 px-2">
                        {parseFloat(String(phase.areaHa)).toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={
                            phase.weeksSinceSowing < 0
                              ? "text-gray-400"
                              : "text-purple-600 font-medium"
                          }
                        >
                          {phase.weeksSinceSowing}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
