"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDashboard } from "../../DashboardContext";
import { hasPermission, Permission } from "@/lib/auth/roles";
import type {
  ProductInventoryItem,
  InventoryTransactionItem,
  PendingIssuance,
  IssuanceFormState,
} from "./types";
import { guessUnit } from "./types";

export function useInventory() {
  const { farms, user, nutriSop, feedingRecords, phases } = useDashboard();

  const isAdmin = user?.role === "ADMIN" || user?.role === "AUDITOR";
  const canEdit = !!user && hasPermission(user.role, Permission.ENTRY_NUTRITION);
  const canDelete = !!user && hasPermission(user.role, Permission.MANAGE_CROPS);

  // Farm selection
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Search
  const [productSearch, setProductSearch] = useState("");

  // Expanded product
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  // Data
  const [inventory, setInventory] = useState<ProductInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Pending queue
  const [pendingQueue, setPendingQueue] = useState<PendingIssuance[]>([]);
  const [saving, setSaving] = useState(false);

  // Issuance form (per expanded row)
  const [issuanceForm, setIssuanceForm] = useState<IssuanceFormState>({
    type: "IN",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Sync state
  const [syncing, setSyncing] = useState(false);

  // Auto-select farm for non-admin users
  useEffect(() => {
    if (!isAdmin && user?.assignedFarmId) {
      setSelectedFarmId(user.assignedFarmId);
    }
  }, [isAdmin, user]);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    if (!selectedFarmId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?farmId=${selectedFarmId}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(
          data.map((d: Record<string, unknown>) => ({
            ...d,
            quantity: Number(d.quantity),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Fetch transactions for expanded product
  const fetchTransactions = useCallback(async () => {
    if (!expandedProductId) {
      setTransactions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/inventory-transactions?productInventoryId=${expandedProductId}`
      );
      if (res.ok) setTransactions(await res.json());
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }, [expandedProductId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // NutriSop product names set
  const nutriSopProductNames = useMemo(
    () => new Set(nutriSop.map((s) => s.products)),
    [nutriSop]
  );

  // Usage from feeding records for this farm
  const usageByProduct = useMemo(() => {
    if (!selectedFarmId) return new Map<string, Map<string, number>>();

    const farm = farms.find((f) => f.id === selectedFarmId);
    if (!farm) return new Map<string, Map<string, number>>();

    const farmPhaseIds = new Set(
      phases.filter((p) => p.farm === farm.name).map((p) => p.id)
    );

    const map = new Map<string, Map<string, number>>();
    for (const record of feedingRecords) {
      if (!farmPhaseIds.has(record.farmPhaseId)) continue;
      const product = record.product;
      const dateStr = new Date(record.applicationDate).toISOString().split("T")[0];
      const qty = parseFloat(String(record.actualQty)) || 0;

      if (!map.has(product)) map.set(product, new Map());
      const dateMap = map.get(product)!;
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + qty);
    }
    return map;
  }, [feedingRecords, phases, farms, selectedFarmId]);

  const totalUsageByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [product, dateMap] of usageByProduct) {
      let total = 0;
      for (const qty of dateMap.values()) total += qty;
      totals.set(product, total);
    }
    return totals;
  }, [usageByProduct]);

  // Categories from loaded inventory
  const categories = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.category))).sort(),
    [inventory]
  );

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    let items = inventory;
    if (selectedCategory) {
      items = items.filter((i) => i.category === selectedCategory);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      items = items.filter((i) => i.product.toLowerCase().includes(q));
    }
    return items;
  }, [inventory, selectedCategory, productSearch]);

  // Add to pending queue
  const addToQueue = (productInventoryId: number, productName: string, unit: string) => {
    if (!issuanceForm.quantity || parseFloat(issuanceForm.quantity) <= 0) return;
    const item: PendingIssuance = {
      key: `${Date.now()}-${Math.random()}`,
      productInventoryId,
      productName,
      unit,
      type: issuanceForm.type,
      quantity: parseFloat(issuanceForm.quantity),
      date: issuanceForm.date,
      notes: issuanceForm.notes,
    };
    setPendingQueue((prev) => [...prev, item]);
    setIssuanceForm({
      type: "IN",
      quantity: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const removeFromQueue = (key: string) => {
    setPendingQueue((prev) => prev.filter((p) => p.key !== key));
  };

  // Save all pending
  const saveAllPending = async () => {
    if (pendingQueue.length === 0) return;
    setSaving(true);
    try {
      const payload = pendingQueue.map((p) => ({
        productInventoryId: p.productInventoryId,
        type: p.type,
        quantity: p.quantity,
        date: p.date,
        notes: p.notes || null,
      }));

      const res = await fetch("/api/inventory-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setPendingQueue([]);
      fetchInventory();
      fetchTransactions();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save issuances");
    } finally {
      setSaving(false);
    }
  };

  // Delete transaction
  const deleteTransaction = async (txnId: number) => {
    if (!confirm("Delete this transaction? This will reverse the stock change.")) return;
    try {
      const res = await fetch(`/api/inventory-transactions?id=${txnId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchInventory();
      fetchTransactions();
    } catch {
      alert("Failed to delete transaction");
    }
  };

  // Sync NutriSop products
  const syncProducts = async () => {
    if (!selectedFarmId) return;
    setSyncing(true);
    try {
      const productMap = new Map<string, { category: string; unit: string }>();
      for (const sop of nutriSop) {
        if (!productMap.has(sop.products)) {
          productMap.set(sop.products, {
            category: sop.category || "Farm Input",
            unit: guessUnit(sop.category),
          });
        }
      }

      const items = Array.from(productMap.entries()).map(([product, info]) => ({
        product,
        category: info.category,
        unit: info.unit,
        farmId: selectedFarmId,
        quantity: 0,
      }));

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!res.ok) throw new Error("Failed to sync products");
      fetchInventory();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  // Farm change handler
  const changeFarm = (farmId: number) => {
    setSelectedFarmId(farmId);
    setExpandedProductId(null);
    setSelectedCategory(null);
    setPendingQueue([]);
  };

  return {
    // Auth / role
    isAdmin,
    canEdit,
    canDelete,
    user,
    farms,

    // Farm
    selectedFarmId,
    setSelectedFarmId,
    changeFarm,

    // Filters
    selectedCategory,
    setSelectedCategory,
    productSearch,
    setProductSearch,
    categories,

    // Product data
    inventory,
    filteredInventory,
    loading,
    expandedProductId,
    setExpandedProductId,

    // Transactions
    transactions,
    deleteTransaction,

    // Queue
    pendingQueue,
    saving,
    addToQueue,
    removeFromQueue,
    saveAllPending,

    // Issuance form
    issuanceForm,
    setIssuanceForm,

    // Sync
    syncing,
    syncProducts,

    // Usage
    nutriSopProductNames,
    usageByProduct,
    totalUsageByProduct,
  };
}
