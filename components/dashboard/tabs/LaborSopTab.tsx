"use client";

import CSVUploader from "@/components/CSVUploader";
import DataTable from "@/components/DataTable";
import { useDashboard, LABOR_HEADERS, LABOR_COLUMNS } from "../DashboardContext";

export default function LaborSopTab() {
  const { laborSop, loading, handleLaborUpload, handleClearLabor } = useDashboard();

  return (
    <div className="space-y-6">
      <CSVUploader
        title="Upload Labor SOP"
        expectedHeaders={LABOR_HEADERS}
        onUpload={handleLaborUpload}
      />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Uploaded Labor SOP</h2>
          {laborSop.length > 0 && (
            <button
              onClick={handleClearLabor}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          )}
        </div>
        <DataTable data={laborSop} columns={LABOR_COLUMNS} loading={loading} />
      </div>
    </div>
  );
}
