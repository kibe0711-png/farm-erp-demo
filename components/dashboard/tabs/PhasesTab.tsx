"use client";

import CSVUploader from "@/components/CSVUploader";
import DataTable from "@/components/DataTable";
import WeekSelector from "../WeekSelector";
import { useDashboard, PHASE_HEADERS, PHASE_COLUMNS, getYears, getWeeks } from "../DashboardContext";

export default function PhasesTab() {
  const {
    phasesWithWeeks,
    phases,
    loading,
    handlePhaseUpload,
    handleClearPhases,
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    formattedDate,
  } = useDashboard();

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
          {phases.length > 0 && (
            <button
              onClick={handleClearPhases}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          )}
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

        <DataTable data={phasesWithWeeks} columns={PHASE_COLUMNS} loading={loading} />
      </div>
    </div>
  );
}
