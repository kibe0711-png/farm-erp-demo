"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDashboard, type FarmSummary } from "../DashboardContext";
import WeekSelector from "../WeekSelector";
import { hasPermission, Permission } from "@/lib/auth/roles";
import LabourEntryForm from "./LabourEntryForm";
import LabourPayrollSummary from "./LabourPayrollSummary";

// Local date string helper (avoids UTC shift from toISOString)
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- Types ---

interface CasualWorkerItem {
  id: number;
  name: string;
  nationalId: string | null;
  phone: string | null;
  farm: string;
}

interface ActivityRateItem {
  id: number;
  activity: string;
  rate: number;
  rateType: string;
  farm: string;
}

interface AttendanceRecordItem {
  id: number;
  casualWorkerId: number;
  casualWorker: { name: string; nationalId: string | null };
  date: string;
  weekStartDate: string;
  farmPhaseId: number;
  activity: string;
  rateType: string;
  rate: number;
  units: number;
  adjustment: number;
  amount: number;
  farm: string;
  farmId: number | null;
  notes: string | null;
}

interface FarmWeeklySummary {
  totalCasuals: number;
  totalCost: number;
  daysWithRecords: number;
}

// --- Component ---

export default function LabourManagementTab() {
  const {
    phases,
    farmSummaries,
    selectedMonday,
    selectedWeek,
    selectedYear,
    user,
  } = useDashboard();

  const canEdit = !!user && hasPermission(user.role, Permission.ENTRY_LABOR);

  // Navigation state
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Data state
  const [casualWorkers, setCasualWorkers] = useState<CasualWorkerItem[]>([]);
  const [activityRates, setActivityRates] = useState<ActivityRateItem[]>([]);
  const [dayRecords, setDayRecords] = useState<AttendanceRecordItem[]>([]);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecordItem[]>([]);
  const [farmWeeklySummaries, setFarmWeeklySummaries] = useState<Map<string, FarmWeeklySummary>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const weekStr = toLocalDateStr(selectedMonday);

  // Set default selected date to today (if within week) or Monday
  useEffect(() => {
    const todayStr = toLocalDateStr(new Date());
    const mondayStr = toLocalDateStr(selectedMonday);
    const sunday = new Date(selectedMonday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayStr = toLocalDateStr(sunday);

    if (todayStr >= mondayStr && todayStr <= sundayStr) {
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(mondayStr);
    }
  }, [selectedMonday]);

  // Compute week days for the day picker
  const weekDays = useMemo(() => {
    const days = [];
    const today = toLocalDateStr(new Date());
    for (let i = 0; i < 7; i++) {
      const d = new Date(selectedMonday);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      days.push({
        date: dateStr,
        label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
        isToday: dateStr === today,
      });
    }
    return days;
  }, [selectedMonday]);

  // Farm phases for the selected farm
  const farmPhases = useMemo(
    () => phases.filter((p) => p.farm === selectedFarm && !p.archived),
    [phases, selectedFarm]
  );

  // --- Data Fetching ---

  const fetchWeeklySummaries = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?weekStart=${weekStr}`);
      if (!res.ok) return;
      const records: AttendanceRecordItem[] = await res.json();

      const summaryMap = new Map<string, FarmWeeklySummary>();
      for (const r of records) {
        const existing = summaryMap.get(r.farm) || { totalCasuals: 0, totalCost: 0, daysWithRecords: 0 };
        existing.totalCost += r.amount;
        summaryMap.set(r.farm, existing);
      }
      for (const farm of summaryMap.keys()) {
        const farmRecords = records.filter((r) => r.farm === farm);
        const uniqueCasuals = new Set(farmRecords.map((r) => r.casualWorkerId));
        const uniqueDays = new Set(farmRecords.map((r) => r.date));
        const summary = summaryMap.get(farm)!;
        summary.totalCasuals = uniqueCasuals.size;
        summary.daysWithRecords = uniqueDays.size;
      }
      setFarmWeeklySummaries(summaryMap);
    } catch {
      // ignore
    }
  }, [weekStr]);

  useEffect(() => {
    if (!selectedFarm) fetchWeeklySummaries();
  }, [fetchWeeklySummaries, selectedFarm]);

  useEffect(() => {
    if (!selectedFarm) return;
    Promise.all([
      fetch(`/api/casual-workers?farm=${encodeURIComponent(selectedFarm)}`).then((r) => r.json()),
      fetch(`/api/activity-rates?farm=${encodeURIComponent(selectedFarm)}`).then((r) => r.json()),
    ]).then(([workers, rates]) => {
      setCasualWorkers(workers);
      setActivityRates(rates);
    });
  }, [selectedFarm]);

  const fetchDayRecords = useCallback(async () => {
    if (!selectedFarm || !selectedDate) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance?farm=${encodeURIComponent(selectedFarm)}&date=${selectedDate}`
      );
      if (res.ok) setDayRecords(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedFarm, selectedDate]);

  useEffect(() => {
    fetchDayRecords();
  }, [fetchDayRecords]);

  const fetchWeekRecords = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const res = await fetch(
        `/api/attendance?farm=${encodeURIComponent(selectedFarm)}&weekStart=${weekStr}`
      );
      if (res.ok) setWeekRecords(await res.json());
    } catch {
      // ignore
    }
  }, [selectedFarm, weekStr]);

  useEffect(() => {
    fetchWeekRecords();
  }, [fetchWeekRecords]);

  // --- Handlers ---

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this attendance entry?")) return;
    try {
      const res = await fetch(`/api/attendance?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchDayRecords();
      fetchWeekRecords();
    } catch {
      alert("Failed to delete entry");
    }
  };

  const handleEntrySaved = () => {
    setShowForm(false);
    fetchDayRecords();
    fetchWeekRecords();
  };

  // --- Day summary stats ---
  const daySummary = useMemo(() => {
    const total = dayRecords.reduce((sum, r) => sum + r.amount, 0);
    return { count: dayRecords.length, total };
  }, [dayRecords]);

  const getPhaseLabel = (farmPhaseId: number) => {
    const phase = phases.find((p) => p.id === farmPhaseId);
    return phase ? `${phase.phaseId} (${phase.cropCode})` : `Phase #${farmPhaseId}`;
  };

  // ==========================================
  // RENDER: Farm Cards View
  // ==========================================
  if (!selectedFarm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Labour Management</h1>
        </div>
        <WeekSelector />

        {farmSummaries.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No farms found. Upload farm phases first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {farmSummaries.map((farm: FarmSummary) => {
              const summary = farmWeeklySummaries.get(farm.farm);
              return (
                <button
                  key={farm.farm}
                  onClick={() => setSelectedFarm(farm.farm)}
                  className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-purple-300 hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{farm.farm}</h3>
                      <p className="text-sm text-gray-500">{farm.phaseCount} phase(s)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xl font-bold text-purple-600">{summary?.totalCasuals || 0}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Casuals</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600">
                        {(summary?.totalCost || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">RWF</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-600">{summary?.daysWithRecords || 0}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Days</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Daily Attendance View
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setSelectedFarm(null); setShowForm(false); }}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{selectedFarm} — Labour Management</h1>
      </div>

      <WeekSelector />

      {/* Day Picker */}
      <div className="flex gap-2 flex-wrap">
        {weekDays.map((day) => (
          <button
            key={day.date}
            onClick={() => setSelectedDate(day.date)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              selectedDate === day.date
                ? "bg-purple-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {day.label}
            {day.isToday && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Summary Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{daySummary.count}</span> casuals recorded
          &middot; Total: <span className="font-semibold text-green-600">{daySummary.total.toLocaleString()} RWF</span>
        </p>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700"
          >
            {showForm ? "Cancel" : "Add Entry"}
          </button>
        )}
      </div>

      {/* Add Entry Form */}
      {showForm && canEdit && (
        <LabourEntryForm
          selectedFarm={selectedFarm}
          selectedDate={selectedDate}
          casualWorkers={casualWorkers}
          activityRates={activityRates}
          farmPhases={farmPhases}
          onSaved={handleEntrySaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Attendance Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            Attendance — {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : dayRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No attendance records for this day.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-600">#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-600">Casual Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-600">Phase</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-600">Activity</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-600">Type</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-600">Rate</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-600">Units</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-600">Adj.</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-600">Amount</th>
                  {canEdit && <th className="text-center py-2.5 px-3 font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {dayRecords.map((r, idx) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium">{r.casualWorker.name}</td>
                    <td className="py-2 px-3 text-gray-600">{getPhaseLabel(r.farmPhaseId)}</td>
                    <td className="py-2 px-3">{r.activity}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.rateType === "daily" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {r.rateType === "daily" ? "Daily" : "Per kg"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">{r.rate.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{r.units}</td>
                    <td className="py-2 px-3 text-right text-red-600">{r.adjustment > 0 ? `-${r.adjustment.toLocaleString()}` : "—"}</td>
                    <td className="py-2 px-3 text-right font-semibold">{r.amount.toLocaleString()}</td>
                    {canEdit && (
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly Payroll Summary */}
      <LabourPayrollSummary
        weekRecords={weekRecords}
        selectedFarm={selectedFarm}
        selectedWeek={selectedWeek}
        selectedYear={selectedYear}
        weekStr={weekStr}
      />
    </div>
  );
}
