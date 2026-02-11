"use client";

import { Fragment } from "react";
import type {
  ProductInventoryItem,
  InventoryTransactionItem,
  IssuanceFormState,
} from "./types";
import ExpandedProductRow from "./ExpandedProductRow";

interface InventoryProductTableProps {
  items: ProductInventoryItem[];
  loading: boolean;
  hasInventory: boolean;
  expandedProductId: number | null;
  onToggleExpand: (id: number) => void;
  transactions: InventoryTransactionItem[];
  nutriSopProductNames: Set<string>;
  totalUsageByProduct: Map<string, number>;
  usageByProduct: Map<string, Map<string, number>>;
  canEdit: boolean;
  canDelete: boolean;
  issuanceForm: IssuanceFormState;
  setIssuanceForm: React.Dispatch<React.SetStateAction<IssuanceFormState>>;
  onAddToQueue: (productInventoryId: number, productName: string, unit: string) => void;
  onDeleteTransaction: (id: number) => void;
}

export default function InventoryProductTable({
  items,
  loading,
  hasInventory,
  expandedProductId,
  onToggleExpand,
  transactions,
  nutriSopProductNames,
  totalUsageByProduct,
  usageByProduct,
  canEdit,
  canDelete,
  issuanceForm,
  setIssuanceForm,
  onAddToQueue,
  onDeleteTransaction,
}: InventoryProductTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        {!hasInventory
          ? "No products in inventory. Click 'Sync NutriSop Products' to get started."
          : "No products match your filter."}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-2.5 px-3 font-medium text-gray-600">Product</th>
            <th className="text-left py-2.5 px-3 font-medium text-gray-600">Category</th>
            <th className="text-left py-2.5 px-3 font-medium text-gray-600">Unit</th>
            <th className="text-right py-2.5 px-3 font-medium text-gray-600">Stock</th>
            <th className="text-center py-2.5 px-3 font-medium text-gray-600">SOP</th>
            <th className="text-right py-2.5 px-3 font-medium text-gray-600">Usage</th>
            <th className="text-center py-2.5 px-3 font-medium text-gray-600 w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isNutriProduct = nutriSopProductNames.has(item.product);
            const totalUsage = totalUsageByProduct.get(item.product) || 0;
            const isExpanded = expandedProductId === item.id;

            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    isExpanded ? "bg-amber-50" : ""
                  }`}
                  onClick={() => onToggleExpand(item.id)}
                >
                  <td className="py-2 px-3 font-medium text-gray-900">
                    {item.product}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-500">{item.unit}</td>
                  <td
                    className={`py-2 px-3 text-right font-semibold ${
                      item.quantity <= 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {item.quantity.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {isNutriProduct ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                        No
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {isNutriProduct && totalUsage > 0 ? (
                      <span className="text-blue-600 font-medium">
                        {totalUsage.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-amber-600 text-xs font-medium">
                      {isExpanded ? "Close" : "Details"}
                    </span>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td
                      colSpan={7}
                      className="bg-amber-50/50 p-4 border-b border-amber-200"
                    >
                      <ExpandedProductRow
                        item={item}
                        transactions={transactions}
                        usageByProduct={usageByProduct}
                        nutriSopProductNames={nutriSopProductNames}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        issuanceForm={issuanceForm}
                        setIssuanceForm={setIssuanceForm}
                        onAddToQueue={() =>
                          onAddToQueue(item.id, item.product, item.unit)
                        }
                        onDeleteTransaction={onDeleteTransaction}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
