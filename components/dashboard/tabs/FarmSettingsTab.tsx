"use client";

import { useState } from "react";
import { useDashboard, type FarmItem } from "../DashboardContext";

export default function FarmSettingsTab() {
  const { farms, fetchFarms } = useDashboard();
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const startEdit = (farm: FarmItem) => {
    setEditing((prev) => ({
      ...prev,
      [farm.id]: farm.laborRatePerDay != null ? String(farm.laborRatePerDay) : "",
    }));
  };

  const cancelEdit = (id: number) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveRate = async (id: number) => {
    setSaving(id);
    try {
      const value = editing[id];
      const laborRatePerDay = value !== "" ? parseFloat(value) : null;

      const res = await fetch("/api/farms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, laborRatePerDay }),
      });

      if (res.ok) {
        cancelEdit(id);
        fetchFarms();
      }
    } catch (error) {
      console.error("Failed to save farm settings:", error);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Farm Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set a per-farm labor rate to override the SOP cost-per-casual-day for all labor calculations on that farm.
        </p>
      </div>

      {farms.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No farms found. Upload farm phases first to create farms.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Farm</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Labor Rate/Day (RWF)</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {farms.map((farm) => {
                const isEditing = farm.id in editing;
                const currentRate = farm.laborRatePerDay != null
                  ? parseFloat(String(farm.laborRatePerDay))
                  : null;

                return (
                  <tr key={farm.id} className="border-b border-gray-100">
                    <td className="py-3 px-3 font-medium text-gray-900">{farm.name}</td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editing[farm.id]}
                          onChange={(e) =>
                            setEditing((prev) => ({ ...prev, [farm.id]: e.target.value }))
                          }
                          className="w-40 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="e.g. 1500"
                          autoFocus
                        />
                      ) : currentRate != null ? (
                        <span className="text-teal-700 font-medium">
                          {currentRate.toLocaleString()} RWF
                        </span>
                      ) : (
                        <span className="text-gray-400">Using SOP default</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveRate(farm.id)}
                            disabled={saving === farm.id}
                            className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded disabled:opacity-50"
                          >
                            {saving === farm.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => cancelEdit(farm.id)}
                            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded border border-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(farm)}
                          className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
