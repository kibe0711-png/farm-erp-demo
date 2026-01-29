"use client";

import { useState, useEffect, useCallback } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface NutriGanttActivity {
  key: string; // "farmPhaseId-sopId"
  label: string; // e.g. "FB W3 - CAN"
  farmPhaseId: number;
  sopId: number;
  totalQuantity: number;
}

interface Props {
  activities: NutriGanttActivity[];
  weekStartDate: Date;
  farmPhaseIds: number[];
}

interface ScheduleEntry {
  farmPhaseId: number;
  nutriSopId: number;
  dayOfWeek: number;
}

export default function NutriGanttChart({ activities, weekStartDate, farmPhaseIds }: Props) {
  const [toggled, setToggled] = useState<Record<string, Set<number>>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  const weekStr = weekStartDate.toISOString().split("T")[0];

  const loadSchedule = useCallback(async () => {
    if (farmPhaseIds.length === 0) return;
    try {
      const res = await fetch(
        `/api/nutri-schedule?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        const entries: ScheduleEntry[] = await res.json();
        const newToggled: Record<string, Set<number>> = {};
        entries.forEach((e) => {
          const key = `${e.farmPhaseId}-${e.nutriSopId}`;
          if (!newToggled[key]) newToggled[key] = new Set();
          newToggled[key].add(e.dayOfWeek);
        });
        setToggled(newToggled);
        setDirty(false);
      }
    } catch (error) {
      console.error("Failed to load nutri schedule:", error);
    } finally {
      setLoaded(true);
    }
  }, [farmPhaseIds, weekStr]);

  useEffect(() => {
    setLoaded(false);
    loadSchedule();
  }, [loadSchedule]);

  const toggleCell = (key: string, day: number) => {
    setToggled((prev) => {
      const next = { ...prev };
      const days = new Set(next[key] || []);
      if (days.has(day)) {
        days.delete(day);
      } else {
        days.add(day);
      }
      next[key] = days;
      return next;
    });
    setDirty(true);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const entries: ScheduleEntry[] = [];
      Object.entries(toggled).forEach(([key, days]) => {
        const [farmPhaseId, nutriSopId] = key.split("-").map(Number);
        days.forEach((d) => {
          entries.push({ farmPhaseId, nutriSopId, dayOfWeek: d });
        });
      });

      const res = await fetch("/api/nutri-schedule", {
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
      console.error("Failed to save nutri schedule:", error);
    } finally {
      setSaving(false);
    }
  };

  const getQtyPerDay = (key: string, totalQty: number): number => {
    const days = toggled[key];
    if (!days || days.size === 0) return 0;
    return totalQty / days.size;
  };

  const dayTotals = DAY_LABELS.map((_, dayIdx) => {
    return activities.reduce((sum, act) => {
      const days = toggled[act.key];
      if (!days || !days.has(dayIdx)) return sum;
      return sum + act.totalQuantity / days.size;
    }, 0);
  });

  const grandTotal = activities.reduce((sum, act) => sum + act.totalQuantity, 0);

  if (!loaded) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading schedule...</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No nutrition activities for this week.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[220px]">
                Activity
              </th>
              {DAY_LABELS.map((day) => (
                <th key={day} className="text-center py-2 px-1 font-medium text-gray-700 w-16">
                  {day}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium text-gray-700 w-20">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {activities.map((act, idx) => {
              const days = toggled[act.key] || new Set();
              const qtyPerDay = getQtyPerDay(act.key, act.totalQuantity);
              const prevAct = idx > 0 ? activities[idx - 1] : null;
              const isNewPhase = !prevAct || prevAct.farmPhaseId !== act.farmPhaseId;

              return (
                <tr key={act.key} className={`border-b border-gray-100 ${isNewPhase && idx > 0 ? "border-t-2 border-t-gray-300" : ""}`}>
                  <td className="py-2 px-3 text-gray-800 font-medium text-xs">
                    {act.label}
                  </td>
                  {DAY_LABELS.map((_, dayIdx) => {
                    const isActive = days.has(dayIdx);
                    return (
                      <td key={dayIdx} className="py-1 px-1 text-center">
                        <button
                          onClick={() => toggleCell(act.key, dayIdx)}
                          className={`w-full h-10 rounded text-xs font-semibold transition-colors ${
                            isActive
                              ? "bg-purple-600 text-white hover:bg-purple-700"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {isActive ? qtyPerDay.toFixed(1) : ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center font-semibold text-gray-700 text-xs">
                    {act.totalQuantity.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-3 font-semibold text-gray-700 text-xs">
                Total Qty
              </td>
              {dayTotals.map((total, idx) => (
                <td key={idx} className="py-2 px-1 text-center font-semibold text-xs">
                  <span className={total > 0 ? "text-purple-700" : "text-gray-400"}>
                    {total > 0 ? total.toFixed(1) : "0"}
                  </span>
                </td>
              ))}
              <td className="py-2 px-3 text-center font-bold text-purple-700 text-xs">
                {grandTotal.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveSchedule}
          disabled={saving || !dirty}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Schedule"}
        </button>
        {dirty && (
          <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
