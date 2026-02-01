"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CROP_COLORS: Record<string, { bg: string; text: string }> = {
  FB:  { bg: "bg-red-100",    text: "text-red-700" },
  TSB: { bg: "bg-blue-100",   text: "text-blue-700" },
  GC:  { bg: "bg-green-100",  text: "text-green-700" },
  RC:  { bg: "bg-yellow-100", text: "text-yellow-700" },
  KA:  { bg: "bg-pink-100",   text: "text-pink-700" },
  BC:  { bg: "bg-orange-100", text: "text-orange-700" },
  SP:  { bg: "bg-cyan-100",   text: "text-cyan-700" },
  XFB: { bg: "bg-rose-100",   text: "text-rose-700" },
  MCR: { bg: "bg-indigo-100", text: "text-indigo-700" },
  MCG: { bg: "bg-emerald-100",text: "text-emerald-700" },
};

const DEFAULT_CROP_COLOR = { bg: "bg-gray-100", text: "text-gray-700" };

function getCropColor(cropCode: string) {
  return CROP_COLORS[cropCode] || DEFAULT_CROP_COLOR;
}

export interface HarvestPhaseRow {
  farmPhaseId: number;
  cropCode: string;
  phaseId: string;
}

interface Props {
  phases: HarvestPhaseRow[];
  weekStartDate: Date;
  farmPhaseIds: number[];
  canEdit?: boolean;
}

interface ApiEntry {
  farmPhaseId: number;
  dayOfWeek: number;
  pledgeKg?: string | number | null;
}

// Per-phase state: day index → pledge kg (null = toggled on but no kg entered yet)
type PhaseSchedule = Map<number, number | null>;

export default function HarvestGanttChart({
  phases,
  weekStartDate,
  farmPhaseIds,
  canEdit = false,
}: Props) {
  const [schedule, setSchedule] = useState<Record<string, PhaseSchedule>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  const weekStr = weekStartDate.toISOString().split("T")[0];

  const loadSchedule = useCallback(async () => {
    if (farmPhaseIds.length === 0) return;
    try {
      const res = await fetch(
        `/api/harvest-schedule?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        const entries: ApiEntry[] = await res.json();
        const newSchedule: Record<string, PhaseSchedule> = {};
        entries.forEach((e) => {
          const key = String(e.farmPhaseId);
          if (!newSchedule[key]) newSchedule[key] = new Map();
          const kg = e.pledgeKg != null ? Number(e.pledgeKg) : null;
          newSchedule[key].set(e.dayOfWeek, isNaN(kg as number) ? null : kg);
        });
        setSchedule(newSchedule);
        setDirty(false);
      }
    } catch (error) {
      console.error("Failed to load harvest schedule:", error);
    } finally {
      setLoaded(true);
    }
  }, [farmPhaseIds, weekStr]);

  useEffect(() => {
    setLoaded(false);
    loadSchedule();
  }, [loadSchedule]);

  const toggleCell = (key: string, day: number) => {
    setSchedule((prev) => {
      const next = { ...prev };
      const days = new Map(next[key] || []);
      if (days.has(day)) {
        days.delete(day);
      } else {
        days.set(day, null);
      }
      next[key] = days;
      return next;
    });
    setDirty(true);
  };

  const updatePledge = (key: string, day: number, value: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      const days = new Map(next[key] || []);
      const kg = value === "" ? null : parseFloat(value);
      days.set(day, isNaN(kg as number) ? null : kg);
      next[key] = days;
      return next;
    });
    setDirty(true);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const entries: { farmPhaseId: number; dayOfWeek: number; pledgeKg: number | null }[] = [];
      Object.entries(schedule).forEach(([key, days]) => {
        const farmPhaseId = Number(key);
        days.forEach((kg, d) => {
          entries.push({ farmPhaseId, dayOfWeek: d, pledgeKg: kg });
        });
      });

      const res = await fetch("/api/harvest-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          weekStartDate: weekStr,
          farmPhaseIds,
        }),
      });

      if (res.ok) {
        setDirty(false);
      }
    } catch (error) {
      console.error("Failed to save harvest schedule:", error);
    } finally {
      setSaving(false);
    }
  };

  // Per-day totals (kg)
  const dayKgTotals = DAY_LABELS.map((_, dayIdx) => {
    return phases.reduce((sum, p) => {
      const days = schedule[String(p.farmPhaseId)];
      if (!days || !days.has(dayIdx)) return sum;
      return sum + (days.get(dayIdx) ?? 0);
    }, 0);
  });

  // Per-day phase counts
  const dayPhaseCounts = DAY_LABELS.map((_, dayIdx) => {
    return phases.reduce((sum, p) => {
      const days = schedule[String(p.farmPhaseId)];
      return sum + (days && days.has(dayIdx) ? 1 : 0);
    }, 0);
  });

  // Grand totals
  const grandKgTotal = dayKgTotals.reduce((a, b) => a + b, 0);

  // Per-row kg total
  const getRowKgTotal = (key: string) => {
    const days = schedule[key];
    if (!days) return 0;
    let total = 0;
    days.forEach((kg) => { total += kg ?? 0; });
    return total;
  };

  if (!loaded) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading schedule...</div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No phases for this farm.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-3 font-medium text-gray-700 w-[220px] max-w-[220px]">
                Phase
              </th>
              {DAY_LABELS.map((day) => (
                <th key={day} className="text-center py-2 px-1 font-medium text-gray-700 w-16">
                  {day}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium text-gray-700 w-20">
                Days
              </th>
              <th className="text-center py-2 px-3 font-medium text-amber-700 w-24">
                Kg
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => {
              const key = String(phase.farmPhaseId);
              const days = schedule[key] || new Map();

              return (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-800 font-medium text-xs w-[220px] max-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${getCropColor(phase.cropCode).bg} ${getCropColor(phase.cropCode).text}`}>
                        {phase.cropCode}
                      </span>
                      <span className="truncate">{phase.phaseId}</span>
                    </div>
                  </td>
                  {DAY_LABELS.map((_, dayIdx) => {
                    const isActive = days.has(dayIdx);
                    const kg = days.get(dayIdx);
                    return (
                      <td key={dayIdx} className="py-1 px-1 text-center">
                        {canEdit ? (
                          <HarvestCell
                            isActive={isActive}
                            kg={kg}
                            onToggle={() => toggleCell(key, dayIdx)}
                            onKgChange={(v) => updatePledge(key, dayIdx, v)}
                          />
                        ) : (
                          <div
                            className={`w-full h-10 rounded text-xs font-semibold flex items-center justify-center ${
                              isActive
                                ? "bg-amber-600 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {isActive ? (kg != null ? `${kg}` : "\u2713") : ""}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center font-semibold text-gray-700 text-xs">
                    {days.size}
                  </td>
                  <td className="py-2 px-3 text-center font-semibold text-amber-700 text-xs">
                    {getRowKgTotal(key) > 0 ? getRowKgTotal(key).toLocaleString() : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-3 font-semibold text-gray-700 text-xs">
                Totals
              </td>
              {dayPhaseCounts.map((count, idx) => (
                <td key={idx} className="py-2 px-1 text-center text-xs">
                  <div className={`font-semibold ${count > 0 ? "text-amber-700" : "text-gray-400"}`}>
                    {count}
                  </div>
                  {dayKgTotals[idx] > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium">
                      {dayKgTotals[idx].toLocaleString()} kg
                    </div>
                  )}
                </td>
              ))}
              <td className="py-2 px-3 text-center font-bold text-gray-700 text-xs">
                {dayPhaseCounts.reduce((a, b) => a + b, 0)}
              </td>
              <td className="py-2 px-3 text-center font-bold text-amber-700 text-xs">
                {grandKgTotal > 0 ? `${grandKgTotal.toLocaleString()}` : "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveSchedule}
            disabled={saving || !dirty}
            className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Schedule"}
          </button>
          {dirty && (
            <button
              onClick={loadSchedule}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300"
            >
              Reset
            </button>
          )}
          {dirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Individual harvest cell — toggle + inline kg input */
function HarvestCell({
  isActive,
  kg,
  onToggle,
  onKgChange,
}: {
  isActive: boolean;
  kg: number | null | undefined;
  onToggle: () => void;
  onKgChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isActive) {
    return (
      <button
        onClick={onToggle}
        className="w-full h-10 rounded text-xs font-semibold transition-colors bg-gray-100 text-gray-400 hover:bg-gray-200"
      />
    );
  }

  return (
    <div className="relative w-full h-10">
      <button
        onClick={onToggle}
        className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center text-[8px] text-amber-200 hover:text-white bg-amber-700 hover:bg-red-600 rounded-bl rounded-tr z-10 transition-colors"
        title="Remove"
      >
        ✕
      </button>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        placeholder="kg"
        value={kg != null ? kg : ""}
        onChange={(e) => onKgChange(e.target.value)}
        className="w-full h-10 rounded bg-amber-600 text-white text-xs font-semibold text-center placeholder:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
