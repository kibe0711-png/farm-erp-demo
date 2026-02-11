"use client";

import type { InventoryTransactionItem, IssuanceFormState, UsageEntry } from "./types";

interface ExpandedProductRowProps {
  item: { id: number; product: string; unit: string };
  transactions: InventoryTransactionItem[];
  usageByProduct: Map<string, Map<string, UsageEntry>>;
  nutriSopProductNames: Set<string>;
  canEdit: boolean;
  canDelete: boolean;
  issuanceForm: IssuanceFormState;
  setIssuanceForm: React.Dispatch<React.SetStateAction<IssuanceFormState>>;
  onAddToQueue: () => void;
  onDeleteTransaction: (id: number) => void;
}

const inputClass =
  "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";

export default function ExpandedProductRow({
  item,
  transactions,
  usageByProduct,
  nutriSopProductNames,
  canEdit,
  canDelete,
  issuanceForm,
  setIssuanceForm,
  onAddToQueue,
  onDeleteTransaction,
}: ExpandedProductRowProps) {
  return (
    <div className="space-y-4">
      {/* Issuance form */}
      {canEdit && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Queue Issuance
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Type
              </label>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIssuanceForm((f) => ({ ...f, type: "IN" }));
                  }}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                    issuanceForm.type === "IN"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  IN (Restock)
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIssuanceForm((f) => ({ ...f, type: "OUT" }));
                  }}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                    issuanceForm.type === "OUT"
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  OUT (Issue)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Quantity ({item.unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={issuanceForm.quantity}
                onChange={(e) =>
                  setIssuanceForm((f) => ({ ...f, quantity: e.target.value }))
                }
                onClick={(e) => e.stopPropagation()}
                className={`${inputClass} w-full`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={issuanceForm.date}
                onChange={(e) =>
                  setIssuanceForm((f) => ({ ...f, date: e.target.value }))
                }
                onClick={(e) => e.stopPropagation()}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={issuanceForm.notes}
                onChange={(e) =>
                  setIssuanceForm((f) => ({ ...f, notes: e.target.value }))
                }
                onClick={(e) => e.stopPropagation()}
                className={`${inputClass} w-full`}
                placeholder="Optional"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue();
                }}
                disabled={
                  !issuanceForm.quantity ||
                  parseFloat(issuanceForm.quantity) <= 0
                }
                className="w-full bg-amber-600 text-white py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                + Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Transaction History
        </h4>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 font-medium text-gray-600">
                    Date
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium text-gray-600">
                    Type
                  </th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-600">
                    Quantity
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium text-gray-600">
                    Notes
                  </th>
                  {canDelete && (
                    <th className="text-center py-1.5 px-2 font-medium text-gray-600 w-16">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-2">
                      {new Date(txn.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          txn.type === "IN"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {txn.type === "IN" ? "Restock" : "Issued Out"}
                      </span>
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-medium ${
                        txn.type === "IN" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {txn.type === "IN" ? "+" : "-"}
                      {txn.quantity.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-gray-500">
                      {txn.notes || "-"}
                    </td>
                    {canDelete && (
                      <td className="py-1.5 px-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(txn.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage from feeding records */}
      {nutriSopProductNames.has(item.product) && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Field Usage (from Feeding Records)
          </h4>
          {(() => {
            const productUsage = usageByProduct.get(item.product);
            if (!productUsage || productUsage.size === 0) {
              return (
                <p className="text-sm text-gray-400">
                  No feeding records found for this product.
                </p>
              );
            }
            const entries = Array.from(productUsage.entries()).sort(
              (a, b) => b[0].localeCompare(a[0])
            );
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600">
                        Date
                      </th>
                      <th className="text-right py-1.5 px-2 font-medium text-gray-600">
                        Qty Applied
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600">
                        Phase(s)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(([date, entry]) => (
                      <tr key={date} className="border-b border-gray-100">
                        <td className="py-1.5 px-2">
                          {new Date(date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-1.5 px-2 text-right text-blue-600 font-medium">
                          {entry.total.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex flex-wrap gap-1">
                            {entry.phases.map((p) => (
                              <span
                                key={p.phaseName}
                                className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                                title={`${p.qty.toFixed(2)} applied to ${p.phaseName}`}
                              >
                                {p.phaseName} ({p.qty.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
