"use client";

import type { PendingIssuance } from "./types";

interface InventoryPendingQueueProps {
  queue: PendingIssuance[];
  saving: boolean;
  onSaveAll: () => void;
  onRemove: (key: string) => void;
}

export default function InventoryPendingQueue({
  queue,
  saving,
  onSaveAll,
  onRemove,
}: InventoryPendingQueueProps) {
  if (queue.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-800">
          Pending Issuances ({queue.length})
        </h3>
        <button
          onClick={onSaveAll}
          disabled={saving}
          className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>
      <div className="space-y-1">
        {queue.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-900">{p.productName}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  p.type === "IN"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {p.type === "IN" ? "Restock" : "Issue Out"}
              </span>
              <span
                className={`font-medium ${
                  p.type === "IN" ? "text-green-600" : "text-red-600"
                }`}
              >
                {p.type === "IN" ? "+" : "-"}
                {p.quantity.toFixed(2)} {p.unit}
              </span>
              <span className="text-gray-400">
                {new Date(p.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              {p.notes && (
                <span className="text-gray-400 truncate max-w-[150px]">
                  {p.notes}
                </span>
              )}
            </div>
            <button
              onClick={() => onRemove(p.key)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
