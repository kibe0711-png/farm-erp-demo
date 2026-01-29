"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────
export interface Phase {
  id: number;
  cropCode: string;
  phaseId: string;
  sowingDate: string;
  farm: string;
  areaHa: string | number;
}

export interface LaborSopItem {
  id: number;
  cropCode: string;
  week: number;
  task: string;
  noOfCasuals: number;
  costPerCasualDay: string | number;
  noOfDays: number;
}

export interface NutriSopItem {
  id: number;
  cropCode: string;
  week: number;
  products: string;
  activeIngredient: string;
  rateLitre: string | number;
  rateHa: string | number;
  unitPriceRwf: string | number;
  cost: string | number;
}

export interface FarmSummary {
  farm: string;
  totalAcreage: number;
  phaseCount: number;
  totalLaborCost: number;
  totalNutriCost: number;
}

export interface FeedingRecord {
  id: number;
  farmPhaseId: number;
  applicationDate: string;
  product: string;
  actualRateHa: string | number;
  actualQty: string | number;
  notes: string | null;
}

// ── Constants ──────────────────────────────────────────────────────
export const PHASE_HEADERS = ["crop_code", "phase_id", "sowing_date", "farm", "area_ha"];
export const LABOR_HEADERS = ["crop_code", "week", "task", "no_of_casuals", "cost_per_casual_day", "no_of_days"];
export const NUTRI_HEADERS = ["crop_code", "week", "products", "active_ingridient", "rate_litre", "rate_ha", "unit_price_rwf", "cost"];

export const PHASE_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "phaseId", label: "Phase ID" },
  { key: "sowingDate", label: "Sowing Date" },
  { key: "farm", label: "Farm" },
  { key: "areaHa", label: "Area (Ha)" },
  { key: "weeksSinceSowing", label: "Weeks Since Sowing" },
];

export const LABOR_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "week", label: "Week" },
  { key: "task", label: "Task" },
  { key: "noOfCasuals", label: "Casuals" },
  { key: "costPerCasualDay", label: "Cost/Day" },
  { key: "noOfDays", label: "Days" },
];

export const NUTRI_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "week", label: "Week" },
  { key: "products", label: "Products" },
  { key: "activeIngredient", label: "Active Ingredient" },
  { key: "rateLitre", label: "Rate/Litre" },
  { key: "rateHa", label: "Rate/Ha" },
  { key: "unitPriceRwf", label: "Unit Price (RWF)" },
  { key: "cost", label: "Cost" },
];

export const ACTIVITY_COLUMNS = [
  { key: "phaseId", label: "Phase" },
  { key: "cropCode", label: "Crop" },
  { key: "areaHa", label: "Area (Ha)" },
  { key: "week", label: "Week" },
  { key: "task", label: "Task" },
  { key: "casuals", label: "Casuals" },
  { key: "days", label: "Days" },
  { key: "totalMandays", label: "Total Mandays" },
  { key: "costPerDay", label: "Cost/Day" },
  { key: "totalCost", label: "Total Cost" },
];

export const NUTRI_ACTIVITY_COLUMNS = [
  { key: "phaseId", label: "Phase" },
  { key: "cropCode", label: "Crop" },
  { key: "areaHa", label: "Area (Ha)" },
  { key: "week", label: "Week" },
  { key: "product", label: "Product" },
  { key: "activeIngredient", label: "Active Ingredient" },
  { key: "rateHa", label: "Rate/Ha" },
  { key: "totalQuantity", label: "Total Qty" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "totalCost", label: "Total Cost" },
];

// ── Utility functions ──────────────────────────────────────────────
export function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  return targetMonday;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getCurrentWeekInfo(): { year: number; week: number } {
  const now = new Date();
  return { year: now.getFullYear(), week: getWeekNumber(now) };
}

export function getWeeks(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

export function getYears(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
}

export function calculateWeeksSinceSowing(sowingDateStr: string, targetMonday: Date): number {
  const sowingDate = new Date(sowingDateStr);
  const diffTime = targetMonday.getTime() - sowingDate.getTime();
  return Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
}

// ── Context ────────────────────────────────────────────────────────
interface DashboardContextValue {
  // Data
  phases: Phase[];
  laborSop: LaborSopItem[];
  nutriSop: NutriSopItem[];
  feedingRecords: FeedingRecord[];
  loading: boolean;

  // Week state
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  selectedWeek: number;
  setSelectedWeek: (w: number) => void;
  selectedMonday: Date;
  formattedDate: string;

  // Computed
  farmSummaries: FarmSummary[];
  phasesWithWeeks: (Phase & { weeksSinceSowing: string | number })[];

  // Fetch
  fetchPhases: () => Promise<void>;
  fetchLaborSop: () => Promise<void>;
  fetchNutriSop: () => Promise<void>;
  fetchFeedingRecords: () => Promise<void>;

  // Upload handlers
  handlePhaseUpload: (data: Record<string, string>[]) => Promise<void>;
  handleLaborUpload: (data: Record<string, string>[]) => Promise<void>;
  handleNutriUpload: (data: Record<string, string>[]) => Promise<void>;

  // Clear
  handleClearPhases: () => Promise<void>;
  handleClearLabor: () => Promise<void>;
  handleClearNutri: () => Promise<void>;

  // Feeding
  handleFeedingSubmit: (form: { product: string; actualQty: string; applicationDate: string; notes: string }, phase: Phase) => Promise<void>;
  handleDeleteFeedingRecord: (id: number) => Promise<void>;

  // Logout
  handleLogout: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [laborSop, setLaborSop] = useState<LaborSopItem[]>([]);
  const [nutriSop, setNutriSop] = useState<NutriSopItem[]>([]);
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const currentWeekInfo = getCurrentWeekInfo();
  const [selectedYear, setSelectedYear] = useState(currentWeekInfo.year);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekInfo.week);

  const selectedMonday = getMondayOfWeek(selectedYear, selectedWeek);
  const formattedDate = selectedMonday.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // ── Fetch functions ──────────────────────────────────────────────
  const fetchPhases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/phases");
      if (res.ok) setPhases(await res.json());
    } catch (error) {
      console.error("Failed to fetch phases:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLaborSop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/labor-sop");
      if (res.ok) setLaborSop(await res.json());
    } catch (error) {
      console.error("Failed to fetch labor SOP:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNutriSop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutri-sop");
      if (res.ok) setNutriSop(await res.json());
    } catch (error) {
      console.error("Failed to fetch nutri SOP:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedingRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/feeding");
      if (res.ok) setFeedingRecords(await res.json());
    } catch (error) {
      console.error("Failed to fetch feeding records:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPhases();
    fetchLaborSop();
    fetchNutriSop();
    fetchFeedingRecords();
  }, [fetchPhases, fetchLaborSop, fetchNutriSop, fetchFeedingRecords]);

  // ── Upload handlers ──────────────────────────────────────────────
  const handlePhaseUpload = async (data: Record<string, string>[]) => {
    const res = await fetch("/api/phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
    fetchPhases();
  };

  const handleLaborUpload = async (data: Record<string, string>[]) => {
    const res = await fetch("/api/labor-sop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
    fetchLaborSop();
  };

  const handleNutriUpload = async (data: Record<string, string>[]) => {
    const res = await fetch("/api/nutri-sop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
    fetchNutriSop();
  };

  // ── Clear handlers ───────────────────────────────────────────────
  const handleClearPhases = async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/phases", { method: "DELETE" });
    if (res.ok) setPhases([]);
  };

  const handleClearLabor = async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/labor-sop", { method: "DELETE" });
    if (res.ok) setLaborSop([]);
  };

  const handleClearNutri = async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/nutri-sop", { method: "DELETE" });
    if (res.ok) setNutriSop([]);
  };

  // ── Feeding handlers ─────────────────────────────────────────────
  const handleFeedingSubmit = async (
    form: { product: string; actualQty: string; applicationDate: string; notes: string },
    phase: Phase
  ) => {
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    const actualQty = parseFloat(form.actualQty) || 0;
    const actualRateHa = areaHa > 0 ? actualQty / areaHa : 0;

    const res = await fetch("/api/feeding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmPhaseId: phase.id,
        ...form,
        actualRateHa,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to save record");
    }
    fetchFeedingRecords();
  };

  const handleDeleteFeedingRecord = async (id: number) => {
    if (!confirm("Delete this feeding record?")) return;
    const res = await fetch(`/api/feeding?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    fetchFeedingRecords();
  };

  // ── Logout ───────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/";
  };

  // ── Computed values ──────────────────────────────────────────────
  const phasesWithWeeks = phases.map((phase) => {
    const sowingDateStr = phase.sowingDate as string;
    if (!sowingDateStr) return { ...phase, weeksSinceSowing: "-" };
    const diffWeeks = calculateWeeksSinceSowing(sowingDateStr, selectedMonday);
    return { ...phase, weeksSinceSowing: diffWeeks >= 0 ? diffWeeks : `${diffWeeks}` };
  });

  const calculatePhaseLaborCost = (phase: Phase): number => {
    const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
    if (weeksSinceSowing < 0) return 0;
    const matchingSop = laborSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
    );
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    return matchingSop.reduce((total, sop) => {
      const costPerDay = parseFloat(String(sop.costPerCasualDay)) || 0;
      const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
      return total + totalMandays * costPerDay;
    }, 0);
  };

  const calculatePhaseNutriCost = (phase: Phase): number => {
    const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
    if (weeksSinceSowing < 0) return 0;
    const matchingSop = nutriSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
    );
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    return matchingSop.reduce((total, sop) => {
      const costPerHa = parseFloat(String(sop.cost)) || 0;
      return total + costPerHa * areaHa;
    }, 0);
  };

  const farmSummaries: FarmSummary[] = phases.reduce((acc: FarmSummary[], phase) => {
    const existing = acc.find((f) => f.farm === phase.farm);
    const areaHa = parseFloat(String(phase.areaHa)) || 0;
    const laborCost = calculatePhaseLaborCost(phase);
    const nutriCost = calculatePhaseNutriCost(phase);

    if (existing) {
      existing.totalAcreage += areaHa;
      existing.phaseCount += 1;
      existing.totalLaborCost += laborCost;
      existing.totalNutriCost += nutriCost;
    } else {
      acc.push({
        farm: phase.farm,
        totalAcreage: areaHa,
        phaseCount: 1,
        totalLaborCost: laborCost,
        totalNutriCost: nutriCost,
      });
    }
    return acc;
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        phases,
        laborSop,
        nutriSop,
        feedingRecords,
        loading,
        selectedYear,
        setSelectedYear,
        selectedWeek,
        setSelectedWeek,
        selectedMonday,
        formattedDate,
        farmSummaries,
        phasesWithWeeks,
        fetchPhases,
        fetchLaborSop,
        fetchNutriSop,
        fetchFeedingRecords,
        handlePhaseUpload,
        handleLaborUpload,
        handleNutriUpload,
        handleClearPhases,
        handleClearLabor,
        handleClearNutri,
        handleFeedingSubmit,
        handleDeleteFeedingRecord,
        handleLogout,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
