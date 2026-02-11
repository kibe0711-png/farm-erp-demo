"use client";

import { useInventory } from "./inventory/useInventory";
import InventoryPendingQueue from "./inventory/InventoryPendingQueue";
import InventoryProductTable from "./inventory/InventoryProductTable";

const inputClass =
  "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";

export default function InventoryTab() {
  const inv = useInventory();

  // No farm selected
  if (!inv.selectedFarmId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>

        {inv.isAdmin && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Farm
            </label>
            <select
              value=""
              onChange={(e) =>
                inv.setSelectedFarmId(e.target.value ? parseInt(e.target.value) : null)
              }
              className={`${inputClass} w-full max-w-xs`}
            >
              <option value="">Choose a farm...</option>
              {inv.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!inv.isAdmin && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              No farm assigned. Contact your administrator.
            </p>
          </div>
        )}
      </div>
    );
  }

  const farmName =
    inv.farms.find((f) => f.id === inv.selectedFarmId)?.name || `Farm #${inv.selectedFarmId}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {inv.isAdmin && (
            <select
              value={inv.selectedFarmId}
              onChange={(e) => inv.changeFarm(parseInt(e.target.value))}
              className={`${inputClass} text-sm`}
            >
              {inv.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {!inv.isAdmin && (
            <span className="text-sm text-gray-500">{farmName}</span>
          )}
        </div>
        {inv.canEdit && (
          <button
            onClick={inv.syncProducts}
            disabled={inv.syncing}
            className="text-sm text-amber-600 border border-amber-300 px-3 py-1.5 rounded hover:bg-amber-50 disabled:opacity-50"
          >
            {inv.syncing ? "Syncing..." : "Sync NutriSop Products"}
          </button>
        )}
      </div>

      {/* Pending queue */}
      <InventoryPendingQueue
        queue={inv.pendingQueue}
        saving={inv.saving}
        onSaveAll={inv.saveAllPending}
        onRemove={inv.removeFromQueue}
      />

      {/* Category pills */}
      {inv.categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => inv.setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !inv.selectedCategory
                ? "bg-amber-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({inv.inventory.length})
          </button>
          {inv.categories.map((cat) => {
            const count = inv.inventory.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() =>
                  inv.setSelectedCategory(
                    inv.selectedCategory === cat ? null : cat
                  )
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  inv.selectedCategory === cat
                    ? "bg-amber-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      {inv.inventory.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inv.productSearch}
            onChange={(e) => inv.setProductSearch(e.target.value)}
            placeholder="Search products..."
            className={`${inputClass} w-64`}
          />
          {inv.productSearch && (
            <button
              onClick={() => inv.setProductSearch("")}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
          {inv.productSearch && (
            <span className="text-xs text-gray-500">
              {inv.filteredInventory.length} result
              {inv.filteredInventory.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Product table */}
      <InventoryProductTable
        items={inv.filteredInventory}
        loading={inv.loading}
        hasInventory={inv.inventory.length > 0}
        expandedProductId={inv.expandedProductId}
        onToggleExpand={(id) =>
          inv.setExpandedProductId(inv.expandedProductId === id ? null : id)
        }
        transactions={inv.transactions}
        nutriSopProductNames={inv.nutriSopProductNames}
        totalUsageByProduct={inv.totalUsageByProduct}
        usageByProduct={inv.usageByProduct}
        canEdit={inv.canEdit}
        canDelete={inv.canDelete}
        issuanceForm={inv.issuanceForm}
        setIssuanceForm={inv.setIssuanceForm}
        onAddToQueue={inv.addToQueue}
        onDeleteTransaction={inv.deleteTransaction}
      />
    </div>
  );
}
