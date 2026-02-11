"use client";

import { useState, useMemo } from "react";
import CSVUploader from "@/components/CSVUploader";
import { useDashboard, NUTRI_HEADERS, type NutriSopItem } from "../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";

export default function NutriSopTab() {
  const {
    nutriSop,
    loading,
    handleNutriUpload,
    handleClearNutri,
    handleUpdateNutriSop,
    handleDeleteNutriSop,
    user,
  } = useDashboard();

  const canManage = user?.role ? hasPermission(user.role, Permission.MANAGE_CROPS) : false;

  // Group by crop code for display
  const groupedByCrop = useMemo(() => {
    const groups = new Map<string, NutriSopItem[]>();
    for (const sop of nutriSop) {
      const existing = groups.get(sop.cropCode) || [];
      existing.push(sop);
      groups.set(sop.cropCode, existing);
    }
    // Sort each group by week
    for (const [, items] of groups) {
      items.sort((a, b) => a.week - b.week);
    }
    return groups;
  }, [nutriSop]);

  const cropCodes = useMemo(() =>
    Array.from(groupedByCrop.keys()).sort(),
  [groupedByCrop]);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    cropCode: "",
    week: "",
    products: "",
    activeIngredient: "",
    rateLitre: "",
    rateHa: "",
    unitPriceRwf: "",
    cost: "",
  });
  const [saving, setSaving] = useState(false);

  // Filter state
  const [selectedCrop, setSelectedCrop] = useState<string>("all");
  const [productSearch, setProductSearch] = useState("");

  const startEdit = (sop: NutriSopItem) => {
    setEditingId(sop.id);
    setEditValues({
      cropCode: sop.cropCode,
      week: String(sop.week),
      products: sop.products,
      activeIngredient: sop.activeIngredient,
      rateLitre: String(sop.rateLitre),
      rateHa: String(sop.rateHa),
      unitPriceRwf: String(sop.unitPriceRwf),
      cost: String(sop.cost),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({
      cropCode: "",
      week: "",
      products: "",
      activeIngredient: "",
      rateLitre: "",
      rateHa: "",
      unitPriceRwf: "",
      cost: "",
    });
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setSaving(true);
    try {
      await handleUpdateNutriSop(editingId, {
        cropCode: editValues.cropCode,
        week: parseInt(editValues.week, 10) || 0,
        products: editValues.products,
        activeIngredient: editValues.activeIngredient,
        rateLitre: parseFloat(editValues.rateLitre) || 0,
        rateHa: parseFloat(editValues.rateHa) || 0,
        unitPriceRwf: parseFloat(editValues.unitPriceRwf) || 0,
        cost: parseFloat(editValues.cost) || 0,
      });
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full";

  // Get items to display based on filter + search
  const displayItems = useMemo(() => {
    let items = selectedCrop === "all" ? nutriSop : (groupedByCrop.get(selectedCrop) || []);
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      items = items.filter(
        (s) => s.products.toLowerCase().includes(q) || s.activeIngredient.toLowerCase().includes(q)
      );
    }
    return items;
  }, [selectedCrop, nutriSop, groupedByCrop, productSearch]);

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
          <div className="flex items-center gap-3">
            {nutriSop.length > 0 && (
              <button
                onClick={handleClearNutri}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {cropCodes.length > 0 && (
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Crop:</label>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Crops ({nutriSop.length})</option>
                {cropCodes.map((crop) => (
                  <option key={crop} value={crop}>
                    {crop} ({groupedByCrop.get(crop)?.length || 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Search:</label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Product or active ingredient..."
                className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
            {productSearch && (
              <span className="text-xs text-gray-500">{displayItems.length} result{displayItems.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No data available</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Ingredient</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate/Litre</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate/Ha</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                  {canManage && (
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayItems.map((sop) => {
                  const isEditing = editingId === sop.id;
                  return (
                    <tr key={sop.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={editValues.cropCode}
                            onChange={(e) => setEditValues({ ...editValues, cropCode: e.target.value })}
                            className={inputClass}
                            style={{ width: "60px" }}
                          />
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {sop.cropCode}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.week}
                            onChange={(e) => setEditValues({ ...editValues, week: e.target.value })}
                            className={inputClass}
                            style={{ width: "60px" }}
                          />
                        ) : (
                          sop.week
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {isEditing ? (
                          <input
                            value={editValues.products}
                            onChange={(e) => setEditValues({ ...editValues, products: e.target.value })}
                            className={inputClass}
                            style={{ minWidth: "150px" }}
                          />
                        ) : (
                          sop.products
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            value={editValues.activeIngredient}
                            onChange={(e) => setEditValues({ ...editValues, activeIngredient: e.target.value })}
                            className={inputClass}
                            style={{ minWidth: "120px" }}
                          />
                        ) : (
                          sop.activeIngredient || "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.rateLitre}
                            onChange={(e) => setEditValues({ ...editValues, rateLitre: e.target.value })}
                            className={inputClass}
                            style={{ width: "80px" }}
                          />
                        ) : (
                          parseFloat(String(sop.rateLitre)).toFixed(2)
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.rateHa}
                            onChange={(e) => setEditValues({ ...editValues, rateHa: e.target.value })}
                            className={inputClass}
                            style={{ width: "80px" }}
                          />
                        ) : (
                          parseFloat(String(sop.rateHa)).toFixed(2)
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="1"
                            value={editValues.unitPriceRwf}
                            onChange={(e) => setEditValues({ ...editValues, unitPriceRwf: e.target.value })}
                            className={inputClass}
                            style={{ width: "90px" }}
                          />
                        ) : (
                          parseFloat(String(sop.unitPriceRwf)).toLocaleString()
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="1"
                            value={editValues.cost}
                            onChange={(e) => setEditValues({ ...editValues, cost: e.target.value })}
                            className={inputClass}
                            style={{ width: "90px" }}
                          />
                        ) : (
                          parseFloat(String(sop.cost)).toLocaleString()
                        )}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-sm whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="text-sm text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded disabled:opacity-50"
                              >
                                {saving ? "..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(sop)}
                                className="text-sm text-blue-600 hover:text-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNutriSop(sop.id)}
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
