"use client";

import { useState, useEffect, useCallback } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface GanttActivity {
  key: string; // "farmPhaseId-sopId"
  label: string; // e.g. "FB W3 - Weeding"
  farmPhaseId: number;
  sopId: number;
  totalMandays: number;
}

interface Props {
  activities: GanttActivity[];
  weekStartDate: Date; // The Monday of the selected week
  farmPhaseIds: number[];
}

interface ScheduleEntry {
  farmPhaseId: number;
  laborSopId: number;
  dayOfWeek: number;
}

export default function LaborGanttChart({ activities, weekStartDate, farmPhaseIds }: Props) {
  // toggled[key] = Set of day indices (0-6)
  const [toggled, setToggled] = useState<Record<string, Set<number>>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  const weekStr = weekStartDate.toISOString().split("T")[0];

  // Load saved schedule when week or farm changes
  const loadSchedule = useCallback(async () => {
    if (farmPhaseIds.length === 0) return;
    try {
      const res = await fetch(
        `/api/labor-schedule?farmPhaseIds=${farmPhaseIds.join(",")}&weekStart=${weekStr}`
      );
      if (res.ok) {
        const entries: ScheduleEntry[] = await res.json();
        const newToggled: Record<string, Set<number>> = {};
        entries.forEach((e) => {
          const key = `${e.farmPhaseId}-${e.laborSopId}`;
          if (!newToggled[key]) newToggled[key] = new Set();
          newToggled[key].add(e.dayOfWeek);
        });
        setToggled(newToggled);
        setDirty(false);
      }
    } catch (error) {
      console.error("Failed to load schedule:", error);
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
        const [farmPhaseId, laborSopId] = key.split("-").map(Number);
        days.forEach((d) => {
          entries.push({ farmPhaseId, laborSopId, dayOfWeek: d });
        });
      });

      const res = await fetch("/api/labor-schedule", {
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
      console.error("Failed to save schedule:", error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate mandays per day for each activity
  const getManDaysPerDay = (key: string, totalMandays: number): number => {
    const days = toggled[key];
    if (!days || days.size === 0) return 0;
    return totalMandays / days.size;
  };

  // Day column totals
  const dayTotals = DAY_LABELS.map((_, dayIdx) => {
    return activities.reduce((sum, act) => {
      const days = toggled[act.key];
      if (!days || !days.has(dayIdx)) return sum;
      return sum + act.totalMandays / days.size;
    }, 0);
  });

  const grandTotal = activities.reduce((sum, act) => sum + act.totalMandays, 0);

  if (!loaded) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading schedule...</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No labor activities for this week.</div>
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
                Mandays
              </th>
            </tr>
          </thead>
          <tbody>
            {activities.map((act) => {
              const days = toggled[act.key] || new Set();
              const mandaysPerDay = getManDaysPerDay(act.key, act.totalMandays);

              return (
                <tr key={act.key} className="border-b border-gray-100">
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
                              ? "bg-teal-600 text-white hover:bg-teal-700"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {isActive ? mandaysPerDay.toFixed(1) : ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center font-semibold text-gray-700 text-xs">
                    {act.totalMandays.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-3 font-semibold text-gray-700 text-xs">
                Total Mandays
              </td>
              {dayTotals.map((total, idx) => (
                <td key={idx} className="py-2 px-1 text-center font-semibold text-xs">
                  <span className={total > 0 ? "text-teal-700" : "text-gray-400"}>
                    {total > 0 ? total.toFixed(1) : "0"}
                  </span>
                </td>
              ))}
              <td className="py-2 px-3 text-center font-bold text-teal-700 text-xs">
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
          className="bg-teal-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
