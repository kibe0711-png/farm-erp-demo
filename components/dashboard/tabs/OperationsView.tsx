"use client";

import { useState, useMemo, useEffect } from "react";
import LaborActivitiesTab from "./LaborActivitiesTab";
import NutriActivitiesTab from "./NutriActivitiesTab";
import FeedingTab from "./FeedingTab";
import LaborLogsTab from "./LaborLogsTab";
import DailyCompliance from "./DailyCompliance";
import HarvestingTab from "./HarvestingTab";
import HarvestRecordsTab from "./HarvestRecordsTab";
import HarvestPerformanceTab from "./HarvestPerformanceTab";
import { useDashboard } from "../DashboardContext";
import { isRoleAtLeast, UserRole } from "@/lib/auth/roles";
import { useAnalytics } from "../../analytics/AnalyticsProvider";

type OpsTab = "activities" | "nutriActivities" | "feeding" | "laborLogs" | "compliance" | "harvesting" | "harvestRecords" | "harvestPerformance";

const ALL_TABS: { id: OpsTab; label: string; minRole?: string }[] = [
  { id: "compliance", label: "Compliance" },
  { id: "activities", label: "Labor Activities" },
  { id: "laborLogs", label: "Labor Logs" },
  { id: "nutriActivities", label: "Nutri Activities" },
  { id: "feeding", label: "Feeding" },
  { id: "harvestRecords", label: "Harvest Records" },
  { id: "harvesting", label: "Farmer Pledge", minRole: UserRole.FARM_SUPERVISOR },
  { id: "harvestPerformance", label: "Harvest Performance", minRole: UserRole.FARM_MANAGER },
];

export default function OperationsView() {
  const { user } = useDashboard();
  const { trackAction } = useAnalytics();
  const [activeTab, setActiveTab] = useState<OpsTab>("compliance");

  const tabs = useMemo(() => {
    return ALL_TABS.filter((tab) => {
      if (!tab.minRole) return true;
      return user?.role ? isRoleAtLeast(user.role, tab.minRole as "FARM_MANAGER") : false;
    });
  }, [user]);

  // Track sub-tab changes in analytics
  useEffect(() => {
    trackAction("operations_subtab_view", {
      subtab: activeTab,
      subtabLabel: ALL_TABS.find((t) => t.id === activeTab)?.label,
    });
  }, [activeTab, trackAction]);

  return (
    <div>
      {/* Horizontal tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === "feeding"
                    ? "border-teal-500 text-teal-600"
                    : tab.id === "laborLogs"
                    ? "border-indigo-500 text-indigo-600"
                    : tab.id === "compliance"
                    ? "border-orange-500 text-orange-600"
                    : tab.id === "harvesting"
                    ? "border-amber-500 text-amber-600"
                    : tab.id === "harvestRecords"
                    ? "border-green-500 text-green-600"
                    : tab.id === "harvestPerformance"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "compliance" && <DailyCompliance />}
      {activeTab === "activities" && <LaborActivitiesTab />}
      {activeTab === "laborLogs" && <LaborLogsTab />}
      {activeTab === "nutriActivities" && <NutriActivitiesTab />}
      {activeTab === "feeding" && <FeedingTab />}
      {activeTab === "harvestRecords" && <HarvestRecordsTab />}
      {activeTab === "harvesting" && <HarvestingTab />}
      {activeTab === "harvestPerformance" && <HarvestPerformanceTab />}
    </div>
  );
}
