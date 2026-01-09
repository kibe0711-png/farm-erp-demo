"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";

interface CSVUploaderProps {
  expectedHeaders: string[];
  onUpload: (data: Record<string, string>[]) => Promise<void>;
  title: string;
}

export default function CSVUploader({ expectedHeaders, onUpload, title }: CSVUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");

  const validateHeaders = (headers: string[]): boolean => {
    // Just check that we have some headers - let the API handle field mapping
    return headers.length > 0;
  };

  const processFile = useCallback(
    (file: File) => {
      setError("");
      setSuccess("");
      setPreview([]);

      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          if (!validateHeaders(headers)) {
            setError(`Invalid CSV headers. Expected: ${expectedHeaders.join(", ")}`);
            return;
          }
          setPreview(results.data as Record<string, string>[]);
        },
        error: () => {
          setError("Failed to parse CSV file");
        },
      });
    },
    [expectedHeaders]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setUploading(true);
    setError("");
    try {
      await onUpload(preview);
      setSuccess(`Successfully uploaded ${preview.length} records`);
      setPreview([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview([]);
    setError("");
    setSuccess("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">
        Expected columns: {expectedHeaders.join(", ")}
      </p>

      {preview.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-${title}`)?.click()}
        >
          <input
            id={`file-${title}`}
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            Drag and drop a CSV file, or click to select
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {preview.length} rows ready to upload
            </span>
            <button
              onClick={clearPreview}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="overflow-x-auto max-h-64 border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {Object.keys(preview[0]).map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                ... and {preview.length - 10} more rows
              </div>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload Data"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}
    </div>
  );
}
