"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CSVUploader from "@/components/CSVUploader";
import DataTable from "@/components/DataTable";

type Tab = "phases" | "labor" | "nutri" | "activities" | "nutriActivities" | "feeding";

interface Phase {
  id: number;
  cropCode: string;
  phaseId: string;
  sowingDate: string;
  farm: string;
  areaHa: string | number;
}

interface LaborSopItem {
  id: number;
  cropCode: string;
  week: number;
  task: string;
  noOfCasuals: number;
  costPerCasualDay: string | number;
  noOfDays: number;
}

interface NutriSopItem {
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

interface FarmSummary {
  farm: string;
  totalAcreage: number;
  phaseCount: number;
  totalLaborCost: number;
  totalNutriCost: number;
}

interface FeedingRecord {
  id: number;
  farmPhaseId: number;
  applicationDate: string;
  product: string;
  actualRateHa: string | number;
  actualQty: string | number;
  notes: string | null;
}

const PHASE_HEADERS = ["crop_code", "phase_id", "sowing_date", "farm", "area_ha"];
const LABOR_HEADERS = ["crop_code", "week", "task", "no_of_casuals", "cost_per_casual_day", "no_of_days"];
const NUTRI_HEADERS = ["crop_code", "week", "products", "active_ingridient", "rate_litre", "rate_ha", "unit_price_rwf", "cost"];

const PHASE_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "phaseId", label: "Phase ID" },
  { key: "sowingDate", label: "Sowing Date" },
  { key: "farm", label: "Farm" },
  { key: "areaHa", label: "Area (Ha)" },
  { key: "weeksSinceSowing", label: "Weeks Since Sowing" },
];

const LABOR_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "week", label: "Week" },
  { key: "task", label: "Task" },
  { key: "noOfCasuals", label: "Casuals" },
  { key: "costPerCasualDay", label: "Cost/Day" },
  { key: "noOfDays", label: "Days" },
];

const NUTRI_COLUMNS = [
  { key: "cropCode", label: "Crop Code" },
  { key: "week", label: "Week" },
  { key: "products", label: "Products" },
  { key: "activeIngredient", label: "Active Ingredient" },
  { key: "rateLitre", label: "Rate/Litre" },
  { key: "rateHa", label: "Rate/Ha" },
  { key: "unitPriceRwf", label: "Unit Price (RWF)" },
  { key: "cost", label: "Cost" },
];

// Get the Monday of a given week number in a year
function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  return targetMonday;
}

// Get ISO week number from date
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Get current week and year
function getCurrentWeekInfo(): { year: number; week: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    week: getWeekNumber(now),
  };
}

// Generate array of weeks (1-52)
function getWeeks(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

// Generate array of years (current year - 2 to current year + 1)
function getYears(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
}

// Calculate weeks since sowing
function calculateWeeksSinceSowing(sowingDateStr: string, targetMonday: Date): number {
  const sowingDate = new Date(sowingDateStr);
  const diffTime = targetMonday.getTime() - sowingDate.getTime();
  return Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("phases");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [laborSop, setLaborSop] = useState<LaborSopItem[]>([]);
  const [nutriSop, setNutriSop] = useState<NutriSopItem[]>([]);
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Week calculator state
  const currentWeekInfo = getCurrentWeekInfo();
  const [selectedYear, setSelectedYear] = useState(currentWeekInfo.year);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekInfo.week);

  // Activities state
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedNutriFarm, setSelectedNutriFarm] = useState<string | null>(null);
  const [selectedFeedingFarm, setSelectedFeedingFarm] = useState<string | null>(null);
  const [selectedFeedingPhase, setSelectedFeedingPhase] = useState<Phase | null>(null);

  // Feeding form state
  const [feedingForm, setFeedingForm] = useState({
    product: "",
    actualQty: "",
    applicationDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const fetchPhases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/phases");
      if (res.ok) {
        const data = await res.json();
        setPhases(data);
      }
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
      if (res.ok) {
        const data = await res.json();
        setLaborSop(data);
      }
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
      if (res.ok) {
        const data = await res.json();
        setNutriSop(data);
      }
    } catch (error) {
      console.error("Failed to fetch nutri SOP:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedingRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/feeding");
      if (res.ok) {
        const data = await res.json();
        setFeedingRecords(data);
      }
    } catch (error) {
      console.error("Failed to fetch feeding records:", error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "phases") {
      fetchPhases();
    } else if (activeTab === "labor") {
      fetchLaborSop();
    } else if (activeTab === "nutri") {
      fetchNutriSop();
    } else if (activeTab === "activities") {
      fetchPhases();
      fetchLaborSop();
    } else if (activeTab === "nutriActivities") {
      fetchPhases();
      fetchNutriSop();
    } else if (activeTab === "feeding") {
      fetchPhases();
      fetchNutriSop();
      fetchFeedingRecords();
    }
  }, [activeTab, fetchPhases, fetchLaborSop, fetchNutriSop, fetchFeedingRecords]);

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

  const handleFeedingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedingPhase) return;

    const areaHa = parseFloat(String(selectedFeedingPhase.areaHa)) || 0;
    const actualQty = parseFloat(feedingForm.actualQty) || 0;
    const actualRateHa = areaHa > 0 ? actualQty / areaHa : 0;

    try {
      const res = await fetch("/api/feeding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmPhaseId: selectedFeedingPhase.id,
          ...feedingForm,
          actualRateHa,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save record");
      }

      // Reset form and refresh records
      setFeedingForm({
        product: "",
        actualQty: "",
        applicationDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      fetchFeedingRecords();
      alert("Feeding record saved successfully");
    } catch (error) {
      console.error("Failed to save feeding record:", error);
      alert(error instanceof Error ? error.message : "Failed to save record");
    }
  };

  const handleDeleteFeedingRecord = async (id: number) => {
    if (!confirm("Delete this feeding record?")) return;

    try {
      const res = await fetch(`/api/feeding?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchFeedingRecords();
    } catch (error) {
      console.error("Failed to delete feeding record:", error);
      alert("Failed to delete record");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all data in this section?")) return;

    let endpoint = "/api/phases";
    if (activeTab === "labor") endpoint = "/api/labor-sop";
    if (activeTab === "nutri") endpoint = "/api/nutri-sop";

    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      if (activeTab === "phases") {
        setPhases([]);
      } else if (activeTab === "labor") {
        setLaborSop([]);
      } else {
        setNutriSop([]);
      }
    }
  };

  const selectedMonday = getMondayOfWeek(selectedYear, selectedWeek);

  // Calculate weeks since sowing for each phase
  const phasesWithWeeks = phases.map((phase) => {
    const sowingDateStr = phase.sowingDate as string;
    if (!sowingDateStr) return { ...phase, weeksSinceSowing: "-" };

    const diffWeeks = calculateWeeksSinceSowing(sowingDateStr, selectedMonday);

    return {
      ...phase,
      weeksSinceSowing: diffWeeks >= 0 ? diffWeeks : `${diffWeeks}`,
    };
  });

  const formattedDate = selectedMonday.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Calculate labor cost for a single phase
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
      return total + (totalMandays * costPerDay);
    }, 0);
  };

  // Calculate nutri cost for a single phase
  const calculatePhaseNutriCost = (phase: Phase): number => {
    const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
    if (weeksSinceSowing < 0) return 0;

    const matchingSop = nutriSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
    );

    const areaHa = parseFloat(String(phase.areaHa)) || 0;

    return matchingSop.reduce((total, sop) => {
      // Cost per ha × area
      const costPerHa = parseFloat(String(sop.cost)) || 0;
      return total + (costPerHa * areaHa);
    }, 0);
  };

  // Get unique farms with aggregated data including labor and nutri cost
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

  // Get phases for selected farm with calculated weeks (Labor)
  const farmPhases = selectedFarm
    ? phases
        .filter((p) => p.farm === selectedFarm)
        .map((phase) => {
          const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
          return { ...phase, weeksSinceSowing };
        })
    : [];

  // Get phases for selected nutri farm with calculated weeks
  const nutriFarmPhases = selectedNutriFarm
    ? phases
        .filter((p) => p.farm === selectedNutriFarm)
        .map((phase) => {
          const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
          return { ...phase, weeksSinceSowing };
        })
    : [];

  // Calculate labor activities for each phase based on weeks since sowing
  const laborActivities = farmPhases.flatMap((phase) => {
    const weekNum = phase.weeksSinceSowing;
    if (weekNum < 0) return [];

    const matchingSop = laborSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
    );

    const areaHa = parseFloat(String(phase.areaHa)) || 0;

    return matchingSop.map((sop) => {
      const costPerDay = parseFloat(String(sop.costPerCasualDay)) || 0;
      const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
      const totalCost = totalMandays * costPerDay;

      return {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa: areaHa.toFixed(2),
        week: weekNum,
        task: sop.task,
        casuals: sop.noOfCasuals,
        days: sop.noOfDays,
        totalMandays: totalMandays.toFixed(1),
        costPerDay: costPerDay.toFixed(0),
        totalCost: totalCost.toLocaleString(),
      };
    });
  });

  // Calculate nutrition activities for each phase based on weeks since sowing
  const nutriActivities = nutriFarmPhases.flatMap((phase) => {
    const weekNum = phase.weeksSinceSowing;
    if (weekNum < 0) return [];

    const matchingSop = nutriSop.filter(
      (sop) => sop.cropCode === phase.cropCode && sop.week === weekNum
    );

    const areaHa = parseFloat(String(phase.areaHa)) || 0;

    return matchingSop.map((sop) => {
      const rateHa = parseFloat(String(sop.rateHa)) || 0;
      const unitPrice = parseFloat(String(sop.unitPriceRwf)) || 0;
      const costPerHa = parseFloat(String(sop.cost)) || 0;
      const totalQuantity = rateHa * areaHa;
      const totalCost = costPerHa * areaHa;

      return {
        phaseId: phase.phaseId,
        cropCode: phase.cropCode,
        areaHa: areaHa.toFixed(2),
        week: weekNum,
        product: sop.products,
        activeIngredient: sop.activeIngredient,
        rateHa: rateHa.toFixed(2),
        totalQuantity: totalQuantity.toFixed(2),
        unitPrice: unitPrice.toLocaleString(),
        totalCost: totalCost.toLocaleString(),
      };
    });
  });

  const ACTIVITY_COLUMNS = [
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

  const NUTRI_ACTIVITY_COLUMNS = [
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

  // Week selector component
  const WeekSelector = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getYears().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getWeeks().map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500">
          Mon {formattedDate}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Farm Data Manager</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab("phases")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "phases"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Farm Phases
            </button>
            <button
              onClick={() => setActiveTab("labor")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "labor"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Labor SOP
            </button>
            <button
              onClick={() => setActiveTab("nutri")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "nutri"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              SOP Nutri
            </button>
            <button
              onClick={() => { setActiveTab("activities"); setSelectedFarm(null); }}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "activities"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Labor Activities
            </button>
            <button
              onClick={() => { setActiveTab("nutriActivities"); setSelectedNutriFarm(null); }}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "nutriActivities"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Nutri Activities
            </button>
            <button
              onClick={() => { setActiveTab("feeding"); setSelectedFeedingFarm(null); setSelectedFeedingPhase(null); }}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === "feeding"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Feeding
            </button>
          </nav>
        </div>

        <div className="space-y-6">
          {activeTab === "phases" && (
            <>
              <CSVUploader
                title="Upload Farm Phases"
                expectedHeaders={PHASE_HEADERS}
                onUpload={handlePhaseUpload}
              />
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Uploaded Phases</h2>
                  {phases.length > 0 && (
                    <button
                      onClick={handleClearData}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Year:</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getYears().map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Week:</label>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getWeeks().map((week) => (
                        <option key={week} value={week}>
                          {week}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-sm text-gray-500">
                    Mon {formattedDate}
                  </span>
                </div>

                <DataTable data={phasesWithWeeks} columns={PHASE_COLUMNS} loading={loading} />
              </div>
            </>
          )}

          {activeTab === "labor" && (
            <>
              <CSVUploader
                title="Upload Labor SOP"
                expectedHeaders={LABOR_HEADERS}
                onUpload={handleLaborUpload}
              />
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Uploaded Labor SOP</h2>
                  {laborSop.length > 0 && (
                    <button
                      onClick={handleClearData}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <DataTable data={laborSop} columns={LABOR_COLUMNS} loading={loading} />
              </div>
            </>
          )}

          {activeTab === "nutri" && (
            <>
              <CSVUploader
                title="Upload SOP Nutri"
                expectedHeaders={NUTRI_HEADERS}
                onUpload={handleNutriUpload}
              />
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Uploaded SOP Nutri</h2>
                  {nutriSop.length > 0 && (
                    <button
                      onClick={handleClearData}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <DataTable data={nutriSop} columns={NUTRI_COLUMNS} loading={loading} />
              </div>
            </>
          )}

          {activeTab === "activities" && (
            <div className="space-y-6">
              <WeekSelector />

              {!selectedFarm ? (
                <>
                  {farmSummaries.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                      <p className="text-gray-500">No farms found. Upload farm phases first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {farmSummaries.map((farm) => (
                        <button
                          key={farm.farm}
                          onClick={() => setSelectedFarm(farm.farm)}
                          className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {farm.farm}
                          </h3>
                          <p className="text-2xl font-bold text-green-600">
                            {farm.totalAcreage.toFixed(2)} Ha
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                          </p>
                          {farm.totalLaborCost > 0 && (
                            <p className="text-lg font-semibold text-blue-600 mt-2">
                              {farm.totalLaborCost.toLocaleString()} RWF
                            </p>
                          )}
                          {farm.totalLaborCost === 0 && (
                            <p className="text-sm text-gray-400 mt-2">
                              No labor activities this week
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <button
                          onClick={() => setSelectedFarm(null)}
                          className="text-sm text-blue-600 hover:text-blue-700 mb-2"
                        >
                          &larr; Back to farms
                        </button>
                        <h2 className="text-xl font-semibold text-gray-900">{selectedFarm}</h2>
                        <p className="text-green-600 font-medium">
                          {farmSummaries.find((f) => f.farm === selectedFarm)?.totalAcreage.toFixed(2)} Ha total
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Phases</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                            </tr>
                          </thead>
                          <tbody>
                            {farmPhases.map((phase) => (
                              <tr key={phase.id} className="border-b border-gray-100">
                                <td className="py-2 px-2">{phase.phaseId}</td>
                                <td className="py-2 px-2">{phase.cropCode}</td>
                                <td className="py-2 px-2">
                                  {new Date(phase.sowingDate).toLocaleDateString("en-GB")}
                                </td>
                                <td className="py-2 px-2">{parseFloat(String(phase.areaHa)).toFixed(2)}</td>
                                <td className="py-2 px-2">
                                  <span className={phase.weeksSinceSowing < 0 ? "text-gray-400" : "text-blue-600 font-medium"}>
                                    {phase.weeksSinceSowing}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Labor Activities for Week {selectedWeek}
                      </h3>
                      {laborActivities.length === 0 ? (
                        <p className="text-gray-500 text-sm py-4">
                          No labor activities for the current week.
                        </p>
                      ) : (
                        <DataTable data={laborActivities} columns={ACTIVITY_COLUMNS} loading={loading} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "nutriActivities" && (
            <div className="space-y-6">
              <WeekSelector />

              {!selectedNutriFarm ? (
                <>
                  {farmSummaries.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                      <p className="text-gray-500">No farms found. Upload farm phases first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {farmSummaries.map((farm) => (
                        <button
                          key={farm.farm}
                          onClick={() => setSelectedNutriFarm(farm.farm)}
                          className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-green-300 hover:shadow-md transition-all"
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {farm.farm}
                          </h3>
                          <p className="text-2xl font-bold text-green-600">
                            {farm.totalAcreage.toFixed(2)} Ha
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                          </p>
                          {farm.totalNutriCost > 0 && (
                            <p className="text-lg font-semibold text-purple-600 mt-2">
                              {farm.totalNutriCost.toLocaleString()} RWF
                            </p>
                          )}
                          {farm.totalNutriCost === 0 && (
                            <p className="text-sm text-gray-400 mt-2">
                              No nutrition activities this week
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <button
                          onClick={() => setSelectedNutriFarm(null)}
                          className="text-sm text-purple-600 hover:text-purple-700 mb-2"
                        >
                          &larr; Back to farms
                        </button>
                        <h2 className="text-xl font-semibold text-gray-900">{selectedNutriFarm}</h2>
                        <p className="text-green-600 font-medium">
                          {farmSummaries.find((f) => f.farm === selectedNutriFarm)?.totalAcreage.toFixed(2)} Ha total
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Phases</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                            </tr>
                          </thead>
                          <tbody>
                            {nutriFarmPhases.map((phase) => (
                              <tr key={phase.id} className="border-b border-gray-100">
                                <td className="py-2 px-2">{phase.phaseId}</td>
                                <td className="py-2 px-2">{phase.cropCode}</td>
                                <td className="py-2 px-2">
                                  {new Date(phase.sowingDate).toLocaleDateString("en-GB")}
                                </td>
                                <td className="py-2 px-2">{parseFloat(String(phase.areaHa)).toFixed(2)}</td>
                                <td className="py-2 px-2">
                                  <span className={phase.weeksSinceSowing < 0 ? "text-gray-400" : "text-purple-600 font-medium"}>
                                    {phase.weeksSinceSowing}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Nutrition Activities for Week {selectedWeek}
                      </h3>
                      {nutriActivities.length === 0 ? (
                        <p className="text-gray-500 text-sm py-4">
                          No nutrition activities for the current week.
                        </p>
                      ) : (
                        <DataTable data={nutriActivities} columns={NUTRI_ACTIVITY_COLUMNS} loading={loading} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "feeding" && (
            <div className="space-y-6">
              <WeekSelector />

              {!selectedFeedingFarm ? (
                <>
                  {farmSummaries.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                      <p className="text-gray-500">No farms found. Upload farm phases first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {farmSummaries.map((farm) => {
                        // Count phases with expected feeding activities this week
                        const farmPhasesForFeeding = phases.filter((p) => p.farm === farm.farm);
                        const phasesWithActivities = farmPhasesForFeeding.filter((phase) => {
                          const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                          return nutriSop.some((sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing);
                        }).length;

                        // Calculate expected entries (SOP products for this week across all phases)
                        let expectedEntries = 0;
                        farmPhasesForFeeding.forEach((phase) => {
                          const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                          const sopForPhase = nutriSop.filter(
                            (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
                          );
                          expectedEntries += sopForPhase.length;
                        });

                        // Calculate week start and end dates for filtering records
                        const weekStart = new Date(selectedMonday);
                        const weekEnd = new Date(selectedMonday);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        weekEnd.setHours(23, 59, 59, 999);

                        // Filter records for this farm AND this week only
                        const farmRecordsThisWeek = feedingRecords.filter((r) => {
                          const recordDate = new Date(r.applicationDate);
                          const isInFarm = farmPhasesForFeeding.some((p) => p.id === r.farmPhaseId);
                          const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
                          return isInFarm && isInWeek;
                        });

                        // Actual entries count for this week
                        const actualEntries = farmRecordsThisWeek.length;

                        let totalVariance = 0;
                        let complianceCount = 0;

                        // Group records by product per phase (only this week's records)
                        farmPhasesForFeeding.forEach((phase) => {
                          const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                          const phaseRecords = farmRecordsThisWeek.filter((r) => r.farmPhaseId === phase.id);
                          const areaHa = parseFloat(String(phase.areaHa)) || 0;

                          // Group by product
                          const byProduct: Record<string, number> = {};
                          phaseRecords.forEach((r) => {
                            byProduct[r.product] = (byProduct[r.product] || 0) + (parseFloat(String(r.actualQty)) || 0);
                          });

                          // Compare each product to SOP for THIS week only
                          Object.entries(byProduct).forEach(([product, actualQty]) => {
                            const sopEntry = nutriSop.find(
                              (s) => s.cropCode === phase.cropCode && s.products === product && s.week === weeksSinceSowing
                            );
                            if (sopEntry) {
                              const expectedRateHa = parseFloat(String(sopEntry.rateHa)) || 0;
                              const expectedQty = expectedRateHa * areaHa;
                              if (expectedQty > 0) {
                                const variance = Math.abs((actualQty - expectedQty) / expectedQty) * 100;
                                totalVariance += Math.max(0, 100 - variance); // Convert to compliance score
                                complianceCount++;
                              }
                            }
                          });
                        });

                        const avgCompliance = complianceCount > 0 ? totalVariance / complianceCount : null;
                        const hasRecords = farmRecordsThisWeek.length > 0;

                        return (
                          <button
                            key={farm.farm}
                            onClick={() => setSelectedFeedingFarm(farm.farm)}
                            className="bg-white rounded-xl border border-gray-200 p-8 text-left hover:border-teal-300 hover:shadow-lg transition-all"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                  {farm.farm}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {farm.phaseCount} phase{farm.phaseCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <p className="text-3xl font-bold text-green-600">
                                {farm.totalAcreage.toFixed(2)} <span className="text-lg">Ha</span>
                              </p>
                            </div>

                            {phasesWithActivities > 0 ? (
                              <p className="text-sm font-medium text-teal-600 mb-4">
                                {phasesWithActivities} phase{phasesWithActivities !== 1 ? "s" : ""} need feeding this week
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 mb-4">
                                No feeding due this week
                              </p>
                            )}

                            {/* Entries Summary */}
                            <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-100">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{expectedEntries}</p>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Expected</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-2xl font-bold ${actualEntries >= expectedEntries ? "text-green-600" : "text-orange-500"}`}>
                                  {actualEntries}
                                </p>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Actual</p>
                              </div>
                            </div>

                            {/* Compliance Section */}
                            {hasRecords && avgCompliance !== null ? (
                              <div className="mt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-600 font-medium">Compliance</span>
                                  <span className={`text-lg font-bold ${
                                    avgCompliance >= 95 ? "text-green-600" :
                                    avgCompliance >= 80 ? "text-yellow-600" :
                                    "text-red-600"
                                  }`}>
                                    {avgCompliance.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      avgCompliance >= 95 ? "bg-green-500" :
                                      avgCompliance >= 80 ? "bg-yellow-500" :
                                      "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, avgCompliance)}%` }}
                                  />
                                </div>
                              </div>
                            ) : hasRecords ? (
                              <p className="text-xs text-gray-400 mt-4">
                                No SOP match for records
                              </p>
                            ) : expectedEntries > 0 ? (
                              <p className="text-xs text-orange-500 mt-4 font-medium">
                                {expectedEntries} feeding record{expectedEntries !== 1 ? "s" : ""} pending
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : !selectedFeedingPhase ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <button
                        onClick={() => setSelectedFeedingFarm(null)}
                        className="text-sm text-teal-600 hover:text-teal-700 mb-2"
                      >
                        &larr; Back to farms
                      </button>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedFeedingFarm}</h2>
                      <p className="text-green-600 font-medium">
                        {farmSummaries.find((f) => f.farm === selectedFeedingFarm)?.totalAcreage.toFixed(2)} Ha total
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Select Phase to Record Feeding</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Phase</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Crop</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Sowing Date</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Area (Ha)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Week</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Expected Products</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phases
                            .filter((p) => p.farm === selectedFeedingFarm)
                            .map((phase) => {
                              const weeksSinceSowing = calculateWeeksSinceSowing(phase.sowingDate, selectedMonday);
                              const expectedSop = nutriSop.filter(
                                (sop) => sop.cropCode === phase.cropCode && sop.week === weeksSinceSowing
                              );
                              const hasExpected = expectedSop.length > 0;

                              // Filter records for this phase AND this week only
                              const weekStart = new Date(selectedMonday);
                              const weekEnd = new Date(selectedMonday);
                              weekEnd.setDate(weekEnd.getDate() + 6);
                              weekEnd.setHours(23, 59, 59, 999);

                              const phaseRecordsThisWeek = feedingRecords.filter((r) => {
                                const recordDate = new Date(r.applicationDate);
                                return r.farmPhaseId === phase.id && recordDate >= weekStart && recordDate <= weekEnd;
                              });

                              // Calculate phase compliance for coloring (this week only)
                              const areaHa = parseFloat(String(phase.areaHa)) || 0;
                              const byProduct: Record<string, number> = {};
                              phaseRecordsThisWeek.forEach((r) => {
                                byProduct[r.product] = (byProduct[r.product] || 0) + (parseFloat(String(r.actualQty)) || 0);
                              });
                              let totalCompliance = 0;
                              let complianceCount = 0;
                              Object.entries(byProduct).forEach(([product, actualQty]) => {
                                // Only match SOP entries for THIS week
                                const sopEntry = nutriSop.find(
                                  (s) => s.cropCode === phase.cropCode && s.products === product && s.week === weeksSinceSowing
                                );
                                if (sopEntry) {
                                  const expectedRateHa = parseFloat(String(sopEntry.rateHa)) || 0;
                                  const expectedQty = expectedRateHa * areaHa;
                                  if (expectedQty > 0) {
                                    const variance = Math.abs((actualQty - expectedQty) / expectedQty) * 100;
                                    totalCompliance += Math.max(0, 100 - variance);
                                    complianceCount++;
                                  }
                                }
                              });
                              const phaseCompliance = complianceCount > 0 ? totalCompliance / complianceCount : null;
                              const phaseColorClass =
                                phaseCompliance === null
                                  ? "text-gray-700"
                                  : phaseCompliance >= 95
                                  ? "text-green-600 font-semibold"
                                  : phaseCompliance >= 80
                                  ? "text-yellow-600 font-semibold"
                                  : "text-red-600 font-semibold";

                              return (
                                <tr key={phase.id} className="border-b border-gray-100">
                                  <td className={`py-2 px-2 ${phaseColorClass}`}>{phase.phaseId}</td>
                                  <td className="py-2 px-2">{phase.cropCode}</td>
                                  <td className="py-2 px-2">
                                    {new Date(phase.sowingDate).toLocaleDateString("en-GB")}
                                  </td>
                                  <td className="py-2 px-2">{parseFloat(String(phase.areaHa)).toFixed(2)}</td>
                                  <td className="py-2 px-2">
                                    <span className={weeksSinceSowing < 0 ? "text-gray-400" : "text-teal-600 font-medium"}>
                                      {weeksSinceSowing}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2">
                                    {hasExpected ? (
                                      <span className="text-sm text-gray-600">
                                        {expectedSop.map((s) => s.products).join(", ")}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-sm">None</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    <button
                                      onClick={() => setSelectedFeedingPhase(phase)}
                                      className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                    >
                                      Record {phaseRecordsThisWeek.length > 0 && `(${phaseRecordsThisWeek.length})`}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="mb-4">
                    <button
                      onClick={() => setSelectedFeedingPhase(null)}
                      className="text-sm text-teal-600 hover:text-teal-700 mb-2"
                    >
                      &larr; Back to phases
                    </button>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedFeedingPhase.phaseId} - {selectedFeedingPhase.cropCode}
                    </h2>
                    <p className="text-gray-600">
                      {selectedFeedingFarm} | {parseFloat(String(selectedFeedingPhase.areaHa)).toFixed(2)} Ha |
                      Week {calculateWeeksSinceSowing(selectedFeedingPhase.sowingDate, selectedMonday)}
                    </p>
                  </div>

                  {/* Expected SOP Section */}
                  {(() => {
                    const weeksSinceSowing = calculateWeeksSinceSowing(selectedFeedingPhase.sowingDate, selectedMonday);
                    const expectedSop = nutriSop.filter(
                      (sop) => sop.cropCode === selectedFeedingPhase.cropCode && sop.week === weeksSinceSowing
                    );
                    const areaHa = parseFloat(String(selectedFeedingPhase.areaHa)) || 0;

                    return expectedSop.length > 0 ? (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Expected (from SOP)</h3>
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1 px-2 font-medium text-gray-600">Product</th>
                              <th className="text-left py-1 px-2 font-medium text-gray-600">Rate/Ha</th>
                              <th className="text-left py-1 px-2 font-medium text-gray-600">Expected Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expectedSop.map((sop, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-1 px-2">{sop.products}</td>
                                <td className="py-1 px-2">{parseFloat(String(sop.rateHa)).toFixed(2)}</td>
                                <td className="py-1 px-2">
                                  {(parseFloat(String(sop.rateHa)) * areaHa).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-700">No SOP entries for this crop/week combination.</p>
                      </div>
                    );
                  })()}

                  {/* Recording Form */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Record Actual Feeding</h3>
                    <form onSubmit={handleFeedingSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Product</label>
                          <select
                            value={feedingForm.product}
                            onChange={(e) => setFeedingForm({ ...feedingForm, product: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          >
                            <option value="">Select product...</option>
                            {(() => {
                              // Get unique products from SOP for this crop
                              const cropProducts = [...new Set(
                                nutriSop
                                  .filter((sop) => sop.cropCode === selectedFeedingPhase.cropCode)
                                  .map((sop) => sop.products)
                              )];
                              return cropProducts.map((product) => (
                                <option key={product} value={product}>
                                  {product}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Application Date</label>
                          <input
                            type="date"
                            value={feedingForm.applicationDate}
                            onChange={(e) => setFeedingForm({ ...feedingForm, applicationDate: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Actual Quantity</label>
                          <input
                            type="number"
                            step="0.01"
                            value={feedingForm.actualQty}
                            onChange={(e) => setFeedingForm({ ...feedingForm, actualQty: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Calculated Rate/Ha</label>
                          <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-700">
                            {(() => {
                              const areaHa = parseFloat(String(selectedFeedingPhase.areaHa)) || 0;
                              const qty = parseFloat(feedingForm.actualQty) || 0;
                              return areaHa > 0 ? (qty / areaHa).toFixed(4) : "0.0000";
                            })()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
                        <textarea
                          value={feedingForm.notes}
                          onChange={(e) => setFeedingForm({ ...feedingForm, notes: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          rows={2}
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-teal-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-teal-700"
                      >
                        Save Record
                      </button>
                    </form>
                  </div>

                  {/* Past Records with Compliance */}
                  {(() => {
                    const phaseRecords = feedingRecords.filter((r) => r.farmPhaseId === selectedFeedingPhase.id);
                    const areaHa = parseFloat(String(selectedFeedingPhase.areaHa)) || 0;

                    // Get expected products from SOP for this crop (all weeks)
                    const expectedProducts = nutriSop.filter(
                      (sop) => sop.cropCode === selectedFeedingPhase.cropCode
                    );

                    // Group actual records by product
                    const actualByProduct: Record<string, { totalQty: number; totalRateHa: number; records: typeof phaseRecords }> = {};
                    phaseRecords.forEach((record) => {
                      if (!actualByProduct[record.product]) {
                        actualByProduct[record.product] = { totalQty: 0, totalRateHa: 0, records: [] };
                      }
                      actualByProduct[record.product].totalQty += parseFloat(String(record.actualQty)) || 0;
                      actualByProduct[record.product].totalRateHa += parseFloat(String(record.actualRateHa)) || 0;
                      actualByProduct[record.product].records.push(record);
                    });

                    return (
                      <>
                        {/* Compliance Summary */}
                        {phaseRecords.length > 0 && (
                          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-800 mb-3">Compliance Summary</h3>
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-blue-200">
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Product</th>
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Rate/Ha</th>
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Rate/Ha</th>
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Expected Qty</th>
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Actual Qty</th>
                                  <th className="text-left py-2 px-2 font-medium text-blue-700">Variance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(actualByProduct).map(([product, data]) => {
                                  const sopEntry = expectedProducts.find((s) => s.products === product);
                                  const expectedRateHa = sopEntry ? parseFloat(String(sopEntry.rateHa)) : 0;
                                  const expectedQty = expectedRateHa * areaHa;
                                  const variance = expectedQty > 0 ? ((data.totalQty - expectedQty) / expectedQty) * 100 : 0;
                                  const isOverApplied = variance > 5;
                                  const isUnderApplied = variance < -5;

                                  return (
                                    <tr key={product} className="border-b border-blue-100">
                                      <td className="py-2 px-2 font-medium">{product}</td>
                                      <td className="py-2 px-2">{expectedRateHa.toFixed(2)}</td>
                                      <td className="py-2 px-2">{data.totalRateHa.toFixed(2)}</td>
                                      <td className="py-2 px-2">{expectedQty.toFixed(2)}</td>
                                      <td className="py-2 px-2">{data.totalQty.toFixed(2)}</td>
                                      <td className={`py-2 px-2 font-medium ${isOverApplied ? "text-red-600" : isUnderApplied ? "text-orange-600" : "text-green-600"}`}>
                                        {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                                        {isOverApplied && " (Over)"}
                                        {isUnderApplied && " (Under)"}
                                        {!isOverApplied && !isUnderApplied && " (OK)"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Records Table */}
                        {phaseRecords.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Feeding Records</h3>
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Product</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Rate/Ha</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Qty</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Notes</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {phaseRecords.map((record) => (
                                  <tr key={record.id} className="border-b border-gray-100">
                                    <td className="py-2 px-2">
                                      {new Date(record.applicationDate).toLocaleDateString("en-GB")}
                                    </td>
                                    <td className="py-2 px-2">{record.product}</td>
                                    <td className="py-2 px-2">{parseFloat(String(record.actualRateHa)).toFixed(2)}</td>
                                    <td className="py-2 px-2">{parseFloat(String(record.actualQty)).toFixed(2)}</td>
                                    <td className="py-2 px-2 text-gray-500">{record.notes || "-"}</td>
                                    <td className="py-2 px-2">
                                      <button
                                        onClick={() => handleDeleteFeedingRecord(record.id)}
                                        className="text-red-600 hover:text-red-700 text-sm"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
