"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

// ── Types ──────────────────────────────────────────────────────────
export interface Phase {
  id: number;
  cropCode: string;
  phaseId: string;
  sowingDate: string;
  farm: string;
  areaHa: string | number;
  archived?: boolean;
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

export interface HarvestLogRecord {
  id: number;
  farmPhaseId: number;
  logDate: string;
  actualKg: string | number;
  grade1Kg: string | number;
  grade2Kg: string | number;
  notes: string | null;
}

export interface FarmItem {
  id: number;
  name: string;
  laborRatePerDay: string | number | null;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  assignedFarmId: number | null;
  assignedFarmName: string | null;
}

export interface KeyInputItem {
  id: number;
  cropCode: string;
  nurseryDays: number;
  outgrowingDays: number;
  yieldPerHa: string | number;
  harvestWeeks: number;
  rejectRate: string | number;
  wk1: string | number | null;
  wk2: string | number | null;
  wk3: string | number | null;
  wk4: string | number | null;
  wk5: string | number | null;
  wk6: string | number | null;
  wk7: string | number | null;
  wk8: string | number | null;
  wk9: string | number | null;
  wk10: string | number | null;
  wk11: string | number | null;
  wk12: string | number | null;
  wk13: string | number | null;
  wk14: string | number | null;
  wk15: string | number | null;
  wk16: string | number | null;
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

export const KEY_INPUT_HEADERS = [
  "cropCode", "nurseryDays", "outgrowingDays", "yieldPerHa",
  "harvestWeeks", "rejectRate",
  "wk1", "wk2", "wk3", "wk4", "wk5", "wk6", "wk7", "wk8",
  "wk9", "wk10", "wk11", "wk12", "wk13", "wk14", "wk15", "wk16",
];

export const KEY_INPUT_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "nurseryDays", label: "Nursery Days" },
  { key: "outgrowingDays", label: "Outgrowing Days" },
  { key: "yieldPerHa", label: "Yield/Ha" },
  { key: "harvestWeeks", label: "Harvest Weeks" },
  { key: "rejectRate", label: "Reject Rate (%)" },
  { key: "wk1", label: "Wk1" },
  { key: "wk2", label: "Wk2" },
  { key: "wk3", label: "Wk3" },
  { key: "wk4", label: "Wk4" },
  { key: "wk5", label: "Wk5" },
  { key: "wk6", label: "Wk6" },
  { key: "wk7", label: "Wk7" },
  { key: "wk8", label: "Wk8" },
  { key: "wk9", label: "Wk9" },
  { key: "wk10", label: "Wk10" },
  { key: "wk11", label: "Wk11" },
  { key: "wk12", label: "Wk12" },
  { key: "wk13", label: "Wk13" },
  { key: "wk14", label: "Wk14" },
  { key: "wk15", label: "Wk15" },
  { key: "wk16", label: "Wk16" },
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
  // Compare calendar dates only, ignoring time/timezone.
  // Sowing dates from DB are UTC midnight — extract via getUTC*.
  // Monday from getMondayOfWeek is local midnight — extract via get*.
  // Both fed into Date.UTC for a clean ms diff with no timezone skew.
  const sowDay = Date.UTC(sowingDate.getUTCFullYear(), sowingDate.getUTCMonth(), sowingDate.getUTCDate());
  const monDay = Date.UTC(targetMonday.getFullYear(), targetMonday.getMonth(), targetMonday.getDate());
  return Math.floor((monDay - sowDay) / (7 * 24 * 60 * 60 * 1000));
}

// ── Context ────────────────────────────────────────────────────────
interface DashboardContextValue {
  // Data
  phases: Phase[];
  laborSop: LaborSopItem[];
  nutriSop: NutriSopItem[];
  keyInputs: KeyInputItem[];
  feedingRecords: FeedingRecord[];
  harvestLogs: HarvestLogRecord[];
  farms: FarmItem[];
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
  fetchKeyInputs: () => Promise<void>;
  fetchFeedingRecords: () => Promise<void>;
  fetchHarvestLogs: () => Promise<void>;
  fetchFarms: () => Promise<void>;

  // Upload handlers
  handlePhaseUpload: (data: Record<string, string>[]) => Promise<void>;
  handleLaborUpload: (data: Record<string, string>[]) => Promise<void>;
  handleNutriUpload: (data: Record<string, string>[]) => Promise<void>;
  handleKeyInputsUpload: (data: Record<string, string>[]) => Promise<void>;

  // Clear
  handleClearPhases: () => Promise<void>;
  handleClearLabor: () => Promise<void>;
  handleClearNutri: () => Promise<void>;
  handleClearKeyInputs: () => Promise<void>;

  // Feeding
  handleFeedingSubmit: (form: { product: string; actualQty: string; applicationDate: string; notes: string }, phase: Phase) => Promise<void>;
  handleDeleteFeedingRecord: (id: number) => Promise<void>;

  // Harvest Logs
  handleHarvestLogSubmit: (form: { logDate: string; grade1Kg: string; grade2Kg: string; notes: string }, phase: Phase) => Promise<void>;
  handleDeleteHarvestLog: (id: number) => Promise<void>;

  // User
  user: AuthUser | null;
  userName: string;

  // Phase CRUD
  handleUpdatePhase: (id: number, updates: Partial<Phase>) => Promise<void>;
  handleDeletePhase: (id: number) => Promise<void>;
  handleAddPhase: (phase: Omit<Phase, "id">) => Promise<void>;

  // Nutri SOP CRUD
  handleUpdateNutriSop: (id: number, updates: Partial<NutriSopItem>) => Promise<void>;
  handleDeleteNutriSop: (id: number) => Promise<void>;

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
  const [harvestLogs, setHarvestLogs] = useState<HarvestLogRecord[]>([]);
  const [keyInputs, setKeyInputs] = useState<KeyInputItem[]>([]);
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

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
      const res = await fetchWithRetry("/api/phases");
      if (res.ok) {
        const allPhases = await res.json();

        // Filter phases by farm access
        // AUDITOR and ADMIN see all farms, others see only their assigned farm
        if (user && user.role !== "ADMIN" && user.role !== "AUDITOR") {
          const assignedFarm = user.assignedFarmName;
          if (assignedFarm) {
            setPhases(allPhases.filter((p: Phase) => p.farm === assignedFarm));
          } else {
            // User has no assigned farm - show nothing
            setPhases([]);
          }
        } else {
          // ADMIN or AUDITOR - show all phases
          setPhases(allPhases);
        }
      }
    } catch (error) {
      console.error("Failed to fetch phases:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchLaborSop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithRetry("/api/labor-sop");
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
      const res = await fetchWithRetry("/api/nutri-sop");
      if (res.ok) setNutriSop(await res.json());
    } catch (error) {
      console.error("Failed to fetch nutri SOP:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedingRecords = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/feeding");
      if (res.ok) setFeedingRecords(await res.json());
    } catch (error) {
      console.error("Failed to fetch feeding records:", error);
    }
  }, []);

  const fetchHarvestLogs = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/harvest-logs");
      if (res.ok) setHarvestLogs(await res.json());
    } catch (error) {
      console.error("Failed to fetch harvest logs:", error);
    }
  }, []);

  const fetchKeyInputs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithRetry("/api/key-inputs");
      if (res.ok) setKeyInputs(await res.json());
    } catch (error) {
      console.error("Failed to fetch key inputs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFarms = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/farms");
      if (res.ok) setFarms(await res.json());
    } catch (error) {
      console.error("Failed to fetch farms:", error);
    }
  }, []);

  // Fetch current user
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  }, []);

  // Initial fetch - user first
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Fetch data after user is loaded (phases depend on user's farm access)
  // Stagger into two batches to avoid overwhelming the DB connection pool
  const dataFetchedRef = useRef(false);
  useEffect(() => {
    if (!user || dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    // Batch 1: Critical data needed for initial render
    Promise.all([fetchPhases(), fetchFarms(), fetchLaborSop()]).then(() => {
      // Batch 2: Secondary data after critical data loads
      fetchNutriSop();
      fetchKeyInputs();
      fetchFeedingRecords();
      fetchHarvestLogs();
    });
  }, [user, fetchPhases, fetchLaborSop, fetchNutriSop, fetchKeyInputs, fetchFeedingRecords, fetchHarvestLogs, fetchFarms]);

  // ── Upload handlers (stable refs) ───────────────────────────────
  const handlePhaseUpload = useCallback(async (data: Record<string, string>[]) => {
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
    fetchFarms();
  }, [fetchPhases, fetchFarms]);

  const handleLaborUpload = useCallback(async (data: Record<string, string>[]) => {
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
  }, [fetchLaborSop]);

  const handleNutriUpload = useCallback(async (data: Record<string, string>[]) => {
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
  }, [fetchNutriSop]);

  const handleKeyInputsUpload = useCallback(async (data: Record<string, string>[]) => {
    const res = await fetch("/api/key-inputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
    fetchKeyInputs();
  }, [fetchKeyInputs]);

  // ── Clear handlers (stable refs) ──────────────────────────────
  const handleClearPhases = useCallback(async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/phases", { method: "DELETE" });
    if (res.ok) setPhases([]);
  }, []);

  const handleClearLabor = useCallback(async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/labor-sop", { method: "DELETE" });
    if (res.ok) setLaborSop([]);
  }, []);

  const handleClearNutri = useCallback(async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/nutri-sop", { method: "DELETE" });
    if (res.ok) setNutriSop([]);
  }, []);

  const handleClearKeyInputs = useCallback(async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;
    const res = await fetch("/api/key-inputs", { method: "DELETE" });
    if (res.ok) setKeyInputs([]);
  }, []);

  // ── Feeding handlers (stable refs) ────────────────────────────
  const handleFeedingSubmit = useCallback(async (
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
  }, [fetchFeedingRecords]);

  const handleDeleteFeedingRecord = useCallback(async (id: number) => {
    if (!confirm("Delete this feeding record?")) return;
    const res = await fetch(`/api/feeding?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    fetchFeedingRecords();
  }, [fetchFeedingRecords]);

  // ── Harvest Log handlers (stable refs) ────────────────────────
  const handleHarvestLogSubmit = useCallback(async (
    form: { logDate: string; grade1Kg: string; grade2Kg: string; notes: string },
    phase: Phase
  ) => {
    const res = await fetch("/api/harvest-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmPhaseId: phase.id,
        logDate: form.logDate,
        grade1Kg: parseFloat(form.grade1Kg) || 0,
        grade2Kg: parseFloat(form.grade2Kg) || 0,
        notes: form.notes || null,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to save record");
    }
    fetchHarvestLogs();
  }, [fetchHarvestLogs]);

  const handleDeleteHarvestLog = useCallback(async (id: number) => {
    if (!confirm("Delete this harvest log?")) return;
    const res = await fetch(`/api/harvest-logs?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    fetchHarvestLogs();
  }, [fetchHarvestLogs]);

  // ── Phase CRUD handlers (stable refs) ─────────────────────────
  const handleUpdatePhase = useCallback(async (id: number, updates: Partial<Phase>) => {
    const res = await fetch("/api/phases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update phase");
    }
    fetchPhases();
    fetchFarms();
  }, [fetchPhases, fetchFarms]);

  const handleDeletePhase = useCallback(async (id: number) => {
    if (!confirm("Delete this phase?")) return;
    const res = await fetch(`/api/phases?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete phase");
    fetchPhases();
  }, [fetchPhases]);

  const handleAddPhase = useCallback(async (phase: Omit<Phase, "id">) => {
    const res = await fetch("/api/phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phase),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add phase");
    }
    fetchPhases();
    fetchFarms();
  }, [fetchPhases, fetchFarms]);

  const userName = user?.name ?? "";

  // ── Nutri SOP CRUD handlers (stable refs) ─────────────────────
  const handleUpdateNutriSop = useCallback(async (id: number, updates: Partial<NutriSopItem>) => {
    const res = await fetch("/api/nutri-sop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update nutri SOP");
    }
    fetchNutriSop();
  }, [fetchNutriSop]);

  const handleDeleteNutriSop = useCallback(async (id: number) => {
    if (!confirm("Delete this SOP entry?")) return;
    const res = await fetch(`/api/nutri-sop?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete nutri SOP");
    fetchNutriSop();
  }, [fetchNutriSop]);

  // ── Logout (stable ref) ───────────────────────────────────────
  const handleLogout = useCallback(async () => {
    // Track logout event (will capture session duration on server side)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {
      // Silently fail if tracking fails
    });

    await fetch("/api/auth", { method: "DELETE" });
    setUser(null);
    window.location.href = "/";
  }, []);

  // ── Computed values (memoized) ───────────────────────────────────
  const phasesWithWeeks = useMemo(() => phases.map((phase) => {
    const sowingDateStr = phase.sowingDate as string;
    if (!sowingDateStr) return { ...phase, weeksSinceSowing: "-" };
    const diffWeeks = calculateWeeksSinceSowing(sowingDateStr, selectedMonday);
    return { ...phase, weeksSinceSowing: diffWeeks >= 0 ? diffWeeks : `${diffWeeks}` };
  }), [phases, selectedMonday]);

  const farmSummaries = useMemo(() => {
    const calcLaborCost = (phase: Phase): number => {
      const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
      if (weeksSinceSowing < 0) return 0;
      const matchingSop = laborSop.filter(
        (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
      );
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      const farmOverride = farms.find((f) => f.name === phase.farm);
      const overrideRate = farmOverride?.laborRatePerDay != null
        ? parseFloat(String(farmOverride.laborRatePerDay))
        : null;

      return matchingSop.reduce((total, sop) => {
        const costPerDay = (overrideRate != null && overrideRate > 0)
          ? overrideRate
          : parseFloat(String(sop.costPerCasualDay)) || 0;
        const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
        return total + totalMandays * costPerDay;
      }, 0);
    };

    const calcNutriCost = (phase: Phase): number => {
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

    return phases.reduce((acc: FarmSummary[], phase) => {
      const existing = acc.find((f) => f.farm === phase.farm);
      const areaHa = parseFloat(String(phase.areaHa)) || 0;
      const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
      const activeHa = weeksSinceSowing > 0 ? areaHa : 0;
      const laborCost = calcLaborCost(phase);
      const nutriCost = calcNutriCost(phase);

      if (existing) {
        existing.totalAcreage += activeHa;
        existing.phaseCount += 1;
        existing.totalLaborCost += laborCost;
        existing.totalNutriCost += nutriCost;
      } else {
        acc.push({
          farm: phase.farm,
          totalAcreage: activeHa,
          phaseCount: 1,
          totalLaborCost: laborCost,
          totalNutriCost: nutriCost,
        });
      }
      return acc;
    }, []);
  }, [phases, laborSop, nutriSop, farms, selectedMonday]);

  const contextValue = useMemo<DashboardContextValue>(() => ({
    phases,
    laborSop,
    nutriSop,
    keyInputs,
    feedingRecords,
    harvestLogs,
    farms,
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
    fetchKeyInputs,
    fetchFeedingRecords,
    fetchHarvestLogs,
    fetchFarms,
    handlePhaseUpload,
    handleLaborUpload,
    handleNutriUpload,
    handleKeyInputsUpload,
    handleClearPhases,
    handleClearLabor,
    handleClearNutri,
    handleClearKeyInputs,
    handleFeedingSubmit,
    handleDeleteFeedingRecord,
    handleHarvestLogSubmit,
    handleDeleteHarvestLog,
    handleUpdatePhase,
    handleDeletePhase,
    handleAddPhase,
    handleUpdateNutriSop,
    handleDeleteNutriSop,
    user,
    userName,
    handleLogout,
  }), [
    phases, laborSop, nutriSop, keyInputs, feedingRecords, harvestLogs, farms, loading,
    selectedYear, selectedWeek, selectedMonday, formattedDate,
    farmSummaries, phasesWithWeeks,
    fetchPhases, fetchLaborSop, fetchNutriSop, fetchKeyInputs,
    fetchFeedingRecords, fetchHarvestLogs, fetchFarms,
    handlePhaseUpload, handleLaborUpload, handleNutriUpload, handleKeyInputsUpload,
    handleClearPhases, handleClearLabor, handleClearNutri, handleClearKeyInputs,
    handleFeedingSubmit, handleDeleteFeedingRecord,
    handleHarvestLogSubmit, handleDeleteHarvestLog,
    handleUpdatePhase, handleDeletePhase, handleAddPhase,
    handleUpdateNutriSop, handleDeleteNutriSop,
    user, userName, handleLogout,
  ]);

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}
