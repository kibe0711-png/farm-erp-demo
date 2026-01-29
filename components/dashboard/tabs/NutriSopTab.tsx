"use client";

import CSVUploader from "@/components/CSVUploader";
import DataTable from "@/components/DataTable";
import { useDashboard, NUTRI_HEADERS, NUTRI_COLUMNS } from "../DashboardContext";

export default function NutriSopTab() {
  const { nutriSop, loading, handleNutriUpload, handleClearNutri } = useDashboard();

  return (
    <div className="space-y-6">
      <CSVUploader
        title="Upload SOP Nutri"
        expectedHeaders={NUTRI_HEADERS}
        onUpload={handleNutriUpload}
      />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Uploaded SOP Nutri</h2>
          {nutriSop.length > 0 && (
            <button
              onClick={handleClearNutri}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          )}
        </div>
        <DataTable data={nutriSop} columns={NUTRI_COLUMNS} loading={loading} />
      </div>
    </div>
  );
}
