"use client";

import { Fragment, useState, useMemo } from "react";
import WeekSelector from "../WeekSelector";
import {
  useDashboard,
  getWeekNumber,
  type Phase,
  type KeyInputItem,
} from "../DashboardContext";

// ── Types ──────────────────────────────────────────────────────────

interface PhaseForecast {
  phaseId: string;
  cropCode: string;
  farm: string;
  areaHa: number;
  sowingDate: string;
  weeklyTons: number[]; // length 8
}

interface CropAggregate {
  cropCode: string;
  phases: PhaseForecast[];
  weeklyTons: number[]; // sum of all phases
}

interface FarmAggregate {
  farm: string;
  crops: CropAggregate[];
  weeklyTons: number[]; // sum of all crops
}

interface WeekColumn {
  weekNumber: number;
  monday: Date;
  label: string;
}

// ── Forecast helpers ───────────────────────────────────────────────

function getWeekDistribution(keyInput: KeyInputItem, weekIndex: number): number {
  if (weekIndex < 1 || weekIndex > 16) return 0;
  const key = `wk${weekIndex}` as keyof KeyInputItem;
  const val = keyInput[key];
  if (val === null || val === undefined) return 0;
  return parseFloat(String(val)) || 0;
}

function calculatePhaseForecast(
  phase: Phase,
  keyInput: KeyInputItem,
  forecastMondays: Date[]
): number[] {
  const areaHa = parseFloat(String(phase.areaHa)) || 0;
  const yieldPerHa = parseFloat(String(keyInput.yieldPerHa)) || 0;
  const rejectRate = parseFloat(String(keyInput.rejectRate)) || 0;
  const nurseryDays = keyInput.nurseryDays || 0;
  const outgrowingDays = keyInput.outgrowingDays || 0;
  const harvestWeeks = keyInput.harvestWeeks || 16;

  const sowingDate = new Date(phase.sowingDate);
  const harvestStartMs =
    sowingDate.getTime() + (nurseryDays + outgrowingDays) * 86400000;

  return forecastMondays.map((forecastMonday) => {
    const diffMs = forecastMonday.getTime() - harvestStartMs;
    const harvestWeekIndex = Math.floor(diffMs / (7 * 86400000)) + 1;

    if (harvestWeekIndex < 1 || harvestWeekIndex > Math.min(harvestWeeks, 16)) {
      return 0;
    }

    const distribution = getWeekDistribution(keyInput, harvestWeekIndex);
    return areaHa * yieldPerHa * distribution * (1 - rejectRate / 100);
  });
}

// ── Component ──────────────────────────────────────────────────────

export default function IPPView() {
  const { phases, keyInputs, selectedMonday, selectedYear, selectedWeek } =
    useDashboard();

  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set());
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set());

  // 8 forecast week columns
  const weekColumns: WeekColumn[] = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const monday = new Date(
        selectedMonday.getTime() + i * 7 * 86400000
      );
      const weekNum = getWeekNumber(monday);
      const dateLabel = monday.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      return {
        weekNumber: weekNum,
        monday,
        label: `W${weekNum} (${dateLabel})`,
      };
    });
  }, [selectedMonday]);

  const forecastMondays = useMemo(
    () => weekColumns.map((wc) => wc.monday),
    [weekColumns]
  );

  // keyInput lookup
  const keyInputMap = useMemo(() => {
    const map = new Map<string, KeyInputItem>();
    for (const ki of keyInputs) {
      map.set(ki.cropCode, ki);
    }
    return map;
  }, [keyInputs]);

  // Build full forecast hierarchy
  const { farmAggregates, grandTotalWeekly } = useMemo(() => {
    const phaseForecastsByFarm = new Map<
      string,
      Map<string, PhaseForecast[]>
    >();

    for (const phase of phases) {
      const keyInput = keyInputMap.get(phase.cropCode);
      if (!keyInput) continue;

      const weeklyTons = calculatePhaseForecast(phase, keyInput, forecastMondays);

      const pf: PhaseForecast = {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        farm: phase.farm,
        areaHa: parseFloat(String(phase.areaHa)) || 0,
        sowingDate: phase.sowingDate,
        weeklyTons,
      };

      if (!phaseForecastsByFarm.has(phase.farm)) {
        phaseForecastsByFarm.set(phase.farm, new Map());
      }
      const cropMap = phaseForecastsByFarm.get(phase.farm)!;
      if (!cropMap.has(phase.cropCode)) {
        cropMap.set(phase.cropCode, []);
      }
      cropMap.get(phase.cropCode)!.push(pf);
    }

    const farmAggs: FarmAggregate[] = [];
    const grandTotal = new Array(8).fill(0);

    for (const [farmName, cropMap] of phaseForecastsByFarm) {
      const crops: CropAggregate[] = [];
      const farmWeekly = new Array(8).fill(0);

      for (const [cropCode, phasesArr] of cropMap) {
        const cropWeekly = new Array(8).fill(0);
        for (const pf of phasesArr) {
          for (let w = 0; w < 8; w++) {
            cropWeekly[w] += pf.weeklyTons[w];
          }
        }
        for (let w = 0; w < 8; w++) {
          farmWeekly[w] += cropWeekly[w];
        }
        crops.push({ cropCode, phases: phasesArr, weeklyTons: cropWeekly });
      }

      for (let w = 0; w < 8; w++) {
        grandTotal[w] += farmWeekly[w];
      }

      crops.sort((a, b) => a.cropCode.localeCompare(b.cropCode));
      farmAggs.push({ farm: farmName, crops, weeklyTons: farmWeekly });
    }

    farmAggs.sort((a, b) => a.farm.localeCompare(b.farm));
    return { farmAggregates: farmAggs, grandTotalWeekly: grandTotal };
  }, [phases, keyInputMap, forecastMondays]);

  // ── Toggle handlers ────────────────────────────────────────────

  const toggleFarm = (farm: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(farm)) {
        next.delete(farm);
        // collapse child crops too
        setExpandedCrops((prevCrops) => {
          const nextCrops = new Set(prevCrops);
          for (const key of prevCrops) {
            if (key.startsWith(`${farm}:`)) nextCrops.delete(key);
          }
          return nextCrops;
        });
      } else {
        next.add(farm);
      }
      return next;
    });
  };

  const toggleCrop = (farm: string, cropCode: string) => {
    const key = `${farm}:${cropCode}`;
    setExpandedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Formatting helpers ─────────────────────────────────────────

  const formatTons = (value: number): string => {
    if (value === 0) return "-";
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const rowTotal = (weeklyTons: number[]): number =>
    weeklyTons.reduce((sum, v) => sum + v, 0);

  const grandTotal8w = grandTotalWeekly.reduce(
    (s: number, v: number) => s + v,
    0
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <WeekSelector />

      {/* Summary header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Integrated Production Plan
            </h2>
            <p className="text-sm text-gray-500">
              8-week rolling forecast from Week {selectedWeek}, {selectedYear}
              {" "}&mdash; Tons per week
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-700">
              {formatTons(grandTotal8w)}
            </p>
            <p className="text-xs text-gray-500">Total Tons (8 weeks)</p>
          </div>
        </div>
      </div>

      {/* Main table */}
      {phases.length === 0 || keyInputs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            {phases.length === 0
              ? "No farm phases found. Upload farm phases first."
              : "No key inputs found. Upload crop key inputs first."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[200px]">
                    Farm / Crop / Phase
                  </th>
                  {weekColumns.map((wc) => (
                    <th
                      key={wc.weekNumber}
                      className="text-right py-2 px-3 font-medium text-gray-700 min-w-[100px]"
                    >
                      {wc.label}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 font-medium text-gray-700 min-w-[100px] bg-gray-100">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {farmAggregates.map((fa) => {
                  const isFarmExpanded = expandedFarms.has(fa.farm);
                  return (
                    <Fragment key={fa.farm}>
                      {/* Farm row */}
                      <tr
                        onClick={() => toggleFarm(fa.farm)}
                        className="border-b border-gray-200 bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          <span className="mr-2 text-gray-400">
                            {isFarmExpanded ? "\u25BE" : "\u25B8"}
                          </span>
                          {fa.farm}
                        </td>
                        {fa.weeklyTons.map((t, i) => (
                          <td
                            key={i}
                            className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums"
                          >
                            {formatTons(t)}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 bg-emerald-100 tabular-nums">
                          {formatTons(rowTotal(fa.weeklyTons))}
                        </td>
                      </tr>

                      {/* Crop rows */}
                      {isFarmExpanded &&
                        fa.crops.map((ca) => {
                          const cropKey = `${fa.farm}:${ca.cropCode}`;
                          const isCropExpanded = expandedCrops.has(cropKey);
                          return (
                            <Fragment key={cropKey}>
                              <tr
                                onClick={() =>
                                  toggleCrop(fa.farm, ca.cropCode)
                                }
                                className="border-b border-gray-100 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <td className="py-2 px-3 pl-8 font-medium text-gray-800">
                                  <span className="mr-2 text-gray-400">
                                    {isCropExpanded ? "\u25BE" : "\u25B8"}
                                  </span>
                                  {ca.cropCode}
                                  <span className="text-xs text-gray-400 ml-2">
                                    ({ca.phases.length} phase
                                    {ca.phases.length !== 1 ? "s" : ""})
                                  </span>
                                </td>
                                {ca.weeklyTons.map((t, i) => (
                                  <td
                                    key={i}
                                    className="py-2 px-3 text-right text-gray-700 tabular-nums"
                                  >
                                    {formatTons(t)}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-right font-semibold text-gray-800 bg-gray-50 tabular-nums">
                                  {formatTons(rowTotal(ca.weeklyTons))}
                                </td>
                              </tr>

                              {/* Phase rows */}
                              {isCropExpanded &&
                                ca.phases.map((pf) => (
                                  <tr
                                    key={`${cropKey}:${pf.phaseId}`}
                                    className="border-b border-gray-50 bg-gray-50"
                                  >
                                    <td className="py-1.5 px-3 pl-14 text-gray-500 text-xs">
                                      {pf.phaseId}
                                      <span className="text-gray-400 ml-2">
                                        ({pf.areaHa.toFixed(2)} Ha)
                                      </span>
                                    </td>
                                    {pf.weeklyTons.map((t, i) => (
                                      <td
                                        key={i}
                                        className="py-1.5 px-3 text-right text-gray-500 text-xs tabular-nums"
                                      >
                                        {formatTons(t)}
                                      </td>
                                    ))}
                                    <td className="py-1.5 px-3 text-right text-gray-600 text-xs font-medium bg-gray-100 tabular-nums">
                                      {formatTons(rowTotal(pf.weeklyTons))}
                                    </td>
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-emerald-100">
                  <td className="py-3 px-3 font-bold text-gray-900">
                    Grand Total
                  </td>
                  {grandTotalWeekly.map((t: number, i: number) => (
                    <td
                      key={i}
                      className="py-3 px-3 text-right font-bold text-emerald-800 tabular-nums"
                    >
                      {formatTons(t)}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right font-bold text-emerald-900 bg-emerald-200 tabular-nums">
                    {formatTons(grandTotal8w)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Units: Tons/week</span>
        <span>&bull;</span>
        <span>
          Formula: areaHa &times; yieldPerHa &times; weekDistribution &times;
          (1 &minus; rejectRate%)
        </span>
        <span>&bull;</span>
        <span>&ldquo;-&rdquo; = no harvest expected</span>
      </div>
    </div>
  );
}
