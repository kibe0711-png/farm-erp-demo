"use client";

import CSVUploader from "@/components/CSVUploader";
import DataTable from "@/components/DataTable";
import { useDashboard, KEY_INPUT_HEADERS, KEY_INPUT_COLUMNS } from "../DashboardContext";

export default function KeyInputsTab() {
  const { keyInputs, loading, handleKeyInputsUpload, handleClearKeyInputs } = useDashboard();

  return (
    <div className="space-y-6">
      <CSVUploader
        title="Upload Key Inputs"
        expectedHeaders={KEY_INPUT_HEADERS}
        onUpload={handleKeyInputsUpload}
      />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Uploaded Key Inputs</h2>
          {keyInputs.length > 0 && (
            <button
              onClick={handleClearKeyInputs}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          )}
        </div>
        <DataTable data={keyInputs} columns={KEY_INPUT_COLUMNS} loading={loading} />
      </div>
    </div>
  );
}
