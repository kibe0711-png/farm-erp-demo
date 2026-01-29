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

interface Override {
  id: number;
  farmPhaseId: number;
  sopId: number;
  sopType: string;
  action: string;
  weekStart: string;
}

interface Props {
  activities: GanttActivity[];
  weekStartDate: Date; // The Monday of the selected week
  farmPhaseIds: number[];
  canEdit?: boolean;
  onRemoveActivity?: (key: string) => void;
  onAddActivity?: (sopId: number, farmPhaseId: number) => void;
  onUndoOverride?: (key: string) => void;
  availableActivities?: { sopId: number; farmPhaseId: number; label: string }[];
  overrides?: Override[];
}

interface ScheduleEntry {
  farmPhaseId: number;
  laborSopId: number;
  dayOfWeek: number;
}

export default function LaborGanttChart({
  activities,
  weekStartDate,
  farmPhaseIds,
  canEdit = false,
  onRemoveActivity,
  onAddActivity,
  onUndoOverride,
  availableActivities,
  overrides,
}: Props) {
  // toggled[key] = Set of day indices (0-6)
  const [toggled, setToggled] = useState<Record<string, Set<number>>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [selectedAddPhase, setSelectedAddPhase] = useState<number | null>(null);

  const weekStr = weekStartDate.toISOString().split("T")[0];

  // Check if an activity has an override (added or is a default that was kept)
  const getOverrideForActivity = (key: string): Override | undefined => {
    if (!overrides) return undefined;
    const [farmPhaseId, sopId] = key.split("-").map(Number);
    return overrides.find(
      (o) => o.farmPhaseId === farmPhaseId && o.sopId === sopId
    );
  };

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

  if (activities.length === 0 && (!availableActivities || availableActivities.length === 0)) {
    return (
      <div className="text-sm text-gray-500 py-4">No labor activities for this week.</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add Activity button — phase → SOP drill-down */}
      {canEdit && onAddActivity && availableActivities && availableActivities.length > 0 && (
        <div className="flex justify-end relative">
          <button
            onClick={() => {
              setShowAddDropdown(!showAddDropdown);
              setSelectedAddPhase(null);
            }}
            className="bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded text-sm font-medium hover:bg-teal-100"
          >
            + Add Activity
          </button>
          {showAddDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto min-w-[300px]">
              {selectedAddPhase === null ? (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200 bg-gray-50">
                    Select Phase
                  </div>
                  {(() => {
                    const phaseIds = [...new Set(availableActivities.map((a) => a.farmPhaseId))];
                    return phaseIds.map((fpId) => {
                      const first = availableActivities.find((a) => a.farmPhaseId === fpId)!;
                      const phaseName = first.label.split(" W")[0];
                      const count = availableActivities.filter((a) => a.farmPhaseId === fpId).length;
                      return (
                        <button
                          key={fpId}
                          onClick={() => setSelectedAddPhase(fpId)}
                          className="flex items-center justify-between w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 border-b border-gray-100 last:border-0"
                        >
                          <span className="font-medium">{phaseName}</span>
                          <span className="text-xs text-gray-400">{count} SOPs &rarr;</span>
                        </button>
                      );
                    });
                  })()}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedAddPhase(null)}
                    className="w-full text-left px-4 py-2 text-xs text-teal-600 hover:text-teal-700 border-b border-gray-200 bg-gray-50 font-medium"
                  >
                    &larr; Back to phases
                  </button>
                  {availableActivities
                    .filter((a) => a.farmPhaseId === selectedAddPhase)
                    .map((item) => (
                      <button
                        key={`${item.farmPhaseId}-${item.sopId}`}
                        onClick={() => {
                          onAddActivity(item.sopId, item.farmPhaseId);
                          setShowAddDropdown(false);
                          setSelectedAddPhase(null);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 border-b border-gray-100 last:border-0"
                      >
                        {item.label}
                      </button>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

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
            {activities.map((act, idx) => {
              const days = toggled[act.key] || new Set();
              const mandaysPerDay = getManDaysPerDay(act.key, act.totalMandays);
              const prevAct = idx > 0 ? activities[idx - 1] : null;
              const isNewPhase = !prevAct || prevAct.farmPhaseId !== act.farmPhaseId;
              const override = getOverrideForActivity(act.key);
              const isAdded = override?.action === "add";

              return (
                <tr key={act.key} className={`border-b border-gray-100 ${isNewPhase && idx > 0 ? "border-t-2 border-t-gray-300" : ""}`}>
                  <td className="py-2 px-3 text-gray-800 font-medium text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex-1">{act.label}</span>
                      {isAdded && (
                        <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                          added
                        </span>
                      )}
                      {canEdit && onRemoveActivity && !isAdded && (
                        <button
                          onClick={() => onRemoveActivity(act.key)}
                          className="text-red-400 hover:text-red-600 text-xs font-bold shrink-0"
                          title="Remove activity from this week"
                        >
                          x
                        </button>
                      )}
                      {canEdit && isAdded && onUndoOverride && (
                        <button
                          onClick={() => onUndoOverride(act.key)}
                          className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
                          title="Undo add"
                        >
                          undo
                        </button>
                      )}
                    </div>
                  </td>
                  {DAY_LABELS.map((_, dayIdx) => {
                    const isActive = days.has(dayIdx);
                    return (
                      <td key={dayIdx} className="py-1 px-1 text-center">
                        {canEdit ? (
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
                        ) : (
                          <div
                            className={`w-full h-10 rounded text-xs font-semibold flex items-center justify-center ${
                              isActive
                                ? "bg-teal-600 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {isActive ? mandaysPerDay.toFixed(1) : ""}
                          </div>
                        )}
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

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveSchedule}
            disabled={saving || !dirty}
            className="bg-teal-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
