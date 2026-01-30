"use client";

import { useState } from "react";
import CSVUploader from "@/components/CSVUploader";
import WeekSelector from "../WeekSelector";
import { useDashboard, PHASE_HEADERS, getYears, getWeeks } from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";

function formatDate(value: string): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  return value;
}

export default function PhasesTab() {
  const {
    phasesWithWeeks,
    phases,
    loading,
    handlePhaseUpload,
    handleClearPhases,
    handleUpdatePhase,
    handleDeletePhase,
    handleAddPhase,
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    formattedDate,
    user,
  } = useDashboard();

  const canManage = user?.role ? hasPermission(user.role, Permission.MANAGE_CROPS) : false;

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    cropCode: "",
    phaseId: "",
    sowingDate: "",
    farm: "",
    areaHa: "",
  });
  const [saving, setSaving] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addValues, setAddValues] = useState({
    cropCode: "",
    phaseId: "",
    sowingDate: "",
    farm: "",
    areaHa: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startEdit = (phase: any) => {
    setEditingId(phase.id);
    setEditValues({
      cropCode: phase.cropCode,
      phaseId: phase.phaseId,
      sowingDate: (phase.sowingDate as string).split("T")[0],
      farm: phase.farm,
      areaHa: String(phase.areaHa),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ cropCode: "", phaseId: "", sowingDate: "", farm: "", areaHa: "" });
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
    setSaving(true);
    try {
      await handleAddPhase(addValues as { cropCode: string; phaseId: string; sowingDate: string; farm: string; areaHa: string });
      setShowAddForm(false);
      setAddValues({ cropCode: "", phaseId: "", sowingDate: "", farm: "", areaHa: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add phase");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-full";

  return (
    <div className="space-y-6">
      <CSVUploader
        title="Upload Farm Phases"
        expectedHeaders={PHASE_HEADERS}
        onUpload={handlePhaseUpload}
      />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Uploaded Phases</h2>
          <div className="flex items-center gap-3">
            {canManage && (
              <button
                onClick={() => setShowAddForm(true)}
                disabled={showAddForm}
                className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded disabled:opacity-50"
              >
                + Add Phase
              </button>
            )}
            {phases.length > 0 && (
              <button
                onClick={handleClearPhases}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getYears().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Week:</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getWeeks().map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">Mon {formattedDate}</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : phasesWithWeeks.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-gray-500">No data available</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sowing Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area (Ha)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weeks Since Sowing</th>
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
                        value={addValues.cropCode}
                        onChange={(e) => setAddValues({ ...addValues, cropCode: e.target.value })}
                        className={inputClass}
                        placeholder="Crop code"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={addValues.phaseId}
                        onChange={(e) => setAddValues({ ...addValues, phaseId: e.target.value })}
                        className={inputClass}
                        placeholder="Phase ID"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={addValues.sowingDate}
                        onChange={(e) => setAddValues({ ...addValues, sowingDate: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={addValues.farm}
                        onChange={(e) => setAddValues({ ...addValues, farm: e.target.value })}
                        className={inputClass}
                        placeholder="Farm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={addValues.areaHa}
                        onChange={(e) => setAddValues({ ...addValues, areaHa: e.target.value })}
                        className={inputClass}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-400">-</td>
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
                            setAddValues({ cropCode: "", phaseId: "", sowingDate: "", farm: "", areaHa: "" });
                          }}
                          className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded border border-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {phasesWithWeeks.map((phase) => {
                  const isEditing = editingId === phase.id;
                  return (
                    <tr key={phase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={editValues.cropCode}
                            onChange={(e) => setEditValues({ ...editValues, cropCode: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          phase.cropCode
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
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
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.sowingDate}
                            onChange={(e) => setEditValues({ ...editValues, sowingDate: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          formatDate(phase.sowingDate)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={editValues.farm}
                            onChange={(e) => setEditValues({ ...editValues, farm: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          phase.farm
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.0001"
                            value={editValues.areaHa}
                            onChange={(e) => setEditValues({ ...editValues, areaHa: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          phase.areaHa
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {phase.weeksSinceSowing}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
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
    </div>
  );
}
