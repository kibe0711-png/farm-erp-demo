"use client";

import { useState, useMemo } from "react";

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

interface PhaseItem {
  id: number;
  cropCode: string;
  phaseId: string;
  farm: string;
}

interface LabourEntryFormProps {
  selectedFarm: string;
  selectedDate: string;
  casualWorkers: CasualWorkerItem[];
  activityRates: ActivityRateItem[];
  farmPhases: PhaseItem[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function LabourEntryForm({
  selectedFarm,
  selectedDate,
  casualWorkers,
  activityRates,
  farmPhases,
  onSaved,
  onCancel,
}: LabourEntryFormProps) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCasuals, setSelectedCasuals] = useState<number[]>([]);
  const [casualSearch, setCasualSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryForm, setEntryForm] = useState({
    casualWorkerId: "",
    farmPhaseId: "",
    activity: "",
    rateType: "daily",
    rate: "",
    units: "1",
    adjustment: "0",
    notes: "",
  });

  const handleActivityChange = (activityName: string) => {
    const matched = activityRates.find((r) => r.activity === activityName);
    if (matched) {
      setEntryForm((prev) => ({
        ...prev,
        activity: activityName,
        rateType: matched.rateType,
        rate: String(matched.rate),
        units: matched.rateType === "daily" ? "1" : prev.units,
      }));
    } else {
      setEntryForm((prev) => ({ ...prev, activity: activityName }));
    }
  };

  const computedAmount = useMemo(() => {
    const rate = parseFloat(entryForm.rate) || 0;
    const units = parseFloat(entryForm.units) || 0;
    const adj = parseFloat(entryForm.adjustment) || 0;
    return Math.max(0, rate * units - adj);
  }, [entryForm.rate, entryForm.units, entryForm.adjustment]);

  const filteredCasuals = useMemo(() => {
    if (casualSearch.length < 2) return [];
    const lower = casualSearch.toLowerCase();
    return casualWorkers.filter((w) => w.name.toLowerCase().includes(lower)).slice(0, 50);
  }, [casualWorkers, casualSearch]);

  const handleSave = async () => {
    if (!selectedFarm || !selectedDate) return;
    setSaving(true);
    try {
      const casualIds = bulkMode ? selectedCasuals : [parseInt(entryForm.casualWorkerId)];
      if (casualIds.length === 0 || (casualIds.length === 1 && isNaN(casualIds[0]))) {
        alert("Please select at least one casual worker.");
        setSaving(false);
        return;
      }
      if (!entryForm.activity || !entryForm.farmPhaseId) {
        alert("Please select a phase and activity.");
        setSaving(false);
        return;
      }

      const entries = casualIds.map((cid) => ({
        casualWorkerId: cid,
        date: selectedDate,
        farmPhaseId: parseInt(entryForm.farmPhaseId),
        activity: entryForm.activity,
        rateType: entryForm.rateType,
        rate: parseFloat(entryForm.rate) || 0,
        units: parseFloat(entryForm.units) || 1,
        adjustment: parseFloat(entryForm.adjustment) || 0,
        farm: selectedFarm,
        farmId: null,
        notes: entryForm.notes || null,
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries.length === 1 ? entries[0] : entries),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save");

      if (result.errors && result.errors.length > 0) {
        alert(`Saved ${result.created} entries. ${result.errors.length} failed (likely duplicates).`);
      }

      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {bulkMode ? "Bulk Add Entries" : "Add Attendance Entry"}
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => { setBulkMode(!bulkMode); setSelectedCasuals([]); }}
            className="text-xs text-green-600 hover:text-green-800 font-medium"
          >
            {bulkMode ? "Switch to Single" : "Switch to Bulk"}
          </button>
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Casual Worker (single mode) */}
        {!bulkMode && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Casual Worker</label>
            <input
              type="text"
              placeholder="Type 2+ chars to search..."
              value={casualSearch}
              onChange={(e) => {
                setCasualSearch(e.target.value);
                setEntryForm((prev) => ({ ...prev, casualWorkerId: "" }));
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {filteredCasuals.length > 0 && !entryForm.casualWorkerId && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded bg-white shadow-lg">
                {filteredCasuals.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setEntryForm((prev) => ({ ...prev, casualWorkerId: String(w.id) }));
                      setCasualSearch(w.name);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-green-50"
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Phase</label>
          <select
            value={entryForm.farmPhaseId}
            onChange={(e) => setEntryForm((prev) => ({ ...prev, farmPhaseId: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select phase...</option>
            {farmPhases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cropCode === "GENERAL" ? "General (Farm overhead)" : `${p.phaseId} — ${p.cropCode}`}
              </option>
            ))}
          </select>
        </div>

        {/* Activity */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Activity</label>
          <select
            value={entryForm.activity}
            onChange={(e) => handleActivityChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select activity...</option>
            {activityRates.map((r) => (
              <option key={r.id} value={r.activity}>
                {r.activity} ({r.rateType === "daily" ? `${r.rate} RWF/day` : `${r.rate} RWF/kg`})
              </option>
            ))}
          </select>
        </div>

        {/* Rate */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Rate (RWF)</label>
          <input
            type="number"
            value={entryForm.rate}
            onChange={(e) => setEntryForm((prev) => ({ ...prev, rate: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Units */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Units ({entryForm.rateType === "per_kg" ? "Kg" : "Days"})
          </label>
          <input
            type="number"
            step="0.5"
            value={entryForm.units}
            onChange={(e) => setEntryForm((prev) => ({ ...prev, units: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Adjustment */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Adjustment (RWF)</label>
          <input
            type="number"
            value={entryForm.adjustment}
            onChange={(e) => setEntryForm((prev) => ({ ...prev, adjustment: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Amount (computed) */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Amount (RWF)</label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-700 font-semibold">
            {computedAmount.toLocaleString()}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Notes</label>
          <input
            type="text"
            value={entryForm.notes}
            onChange={(e) => setEntryForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Bulk mode: casual selection */}
      {bulkMode && (
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Select Casuals ({selectedCasuals.length} selected)
          </label>
          <input
            type="text"
            placeholder="Search casuals..."
            value={casualSearch}
            onChange={(e) => setCasualSearch(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
            {(casualSearch.length >= 2 ? filteredCasuals : casualWorkers.slice(0, 50)).map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-green-50 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={selectedCasuals.includes(w.id)}
                  onChange={(e) => {
                    setSelectedCasuals((prev) =>
                      e.target.checked
                        ? [...prev, w.id]
                        : prev.filter((id) => id !== w.id)
                    );
                  }}
                />
                {w.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-green-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : bulkMode
          ? `Save ${selectedCasuals.length} Entries`
          : "Save Entry"}
      </button>
    </div>
  );
}
