export interface ProductInventoryItem {
  id: number;
  product: string;
  category: string;
  unit: string;
  farmId: number;
  quantity: number;
  farm?: { name: string };
}

export interface InventoryTransactionItem {
  id: number;
  productInventoryId: number;
  product: string;
  category: string;
  unit: string;
  type: "IN" | "OUT";
  quantity: number;
  date: string;
  notes: string | null;
  recordedBy: number;
  createdAt: string;
}

export interface PendingIssuance {
  key: string;
  productInventoryId: number;
  productName: string;
  unit: string;
  type: "IN" | "OUT";
  quantity: number;
  date: string;
  notes: string;
}

export interface IssuanceFormState {
  type: "IN" | "OUT";
  quantity: string;
  date: string;
  notes: string;
}

export function guessUnit(category: string | null): string {
  switch (category) {
    case "Fertiliser":
      return "kg";
    case "Foliar Fertiliser":
    case "Pesticide":
    case "Fungicide":
      return "L";
    default:
      return "Pc";
  }
}
