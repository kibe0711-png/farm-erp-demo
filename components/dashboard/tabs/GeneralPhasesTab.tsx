"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";

export default function GeneralPhasesTab() {
  const {
    phases,
    handleUpdatePhase,
    handleDeletePhase,
    handleAddPhase,
    farmSummaries,
    user,
  } = useDashboard();

  const farmNames = useMemo(
    () => farmSummaries.map((f) => f.farm).sort((a, b) => a.localeCompare(b)),
    [farmSummaries]
  );

  const canManage = user?.role ? hasPermission(user.role, Permission.MANAGE_CROPS) : false;

  // Filter to only GENERAL phases
  const generalPhases = useMemo(
    () => phases
      .filter((p) => p.cropCode === "GENERAL" && !p.archived)
      .sort((a, b) => a.farm.localeCompare(b.farm) || a.phaseId.localeCompare(b.phaseId)),
    [phases]
  );

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ phaseId: "", farm: "" });
  const [saving, setSaving] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addValues, setAddValues] = useState({ phaseId: "", farm: "" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startEdit = (phase: any) => {
    setEditingId(phase.id);
    setEditValues({ phaseId: phase.phaseId, farm: phase.farm });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ phaseId: "", farm: "" });
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setSaving(true);
    try {
      await handleUpdatePhase(editingId, editValues);
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    if (!addValues.phaseId || !addValues.farm) {
      alert("Please fill in the phase name and farm.");
      return;
    }
    setSaving(true);
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      await handleAddPhase({
        cropCode: "GENERAL",
        phaseId: addValues.phaseId,
        sowingDate: `${y}-${m}-${d}`,
        farm: addValues.farm,
        areaHa: "0",
      });
      setShowAddForm(false);
      setAddValues({ phaseId: "", farm: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add phase");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-full";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          General phases for overhead and admin activities — security guards, field supervisors, truck loading, etc.
        </p>
        {canManage && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded disabled:opacity-50"
          >
            + Add General Phase
          </button>
        )}
      </div>

      {generalPhases.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          No general phases yet. Add one to track overhead activities.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm</th>
                {canManage && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {showAddForm && (
                <tr className="bg-teal-50">
                  <td className="px-4 py-2">
                    <input
                      value={addValues.phaseId}
                      onChange={(e) => setAddValues({ ...addValues, phaseId: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Security, Supervision, Transport"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={addValues.farm}
                      onChange={(e) => setAddValues({ ...addValues, farm: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select farm</option>
                      {farmNames.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={submitAdd}
                        disabled={saving}
                        className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setAddValues({ phaseId: "", farm: "" });
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded border border-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {generalPhases.map((phase) => {
                const isEditing = editingId === phase.id;
                return (
                  <tr key={phase.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          value={editValues.phaseId}
                          onChange={(e) => setEditValues({ ...editValues, phaseId: e.target.value })}
                          className={inputClass}
                        />
                      ) : (
                        phase.phaseId
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {isEditing ? (
                        <select
                          value={editValues.farm}
                          onChange={(e) => setEditValues({ ...editValues, farm: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Select farm</option>
                          {farmNames.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        phase.farm
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded border border-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(phase)}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePhase(phase.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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
