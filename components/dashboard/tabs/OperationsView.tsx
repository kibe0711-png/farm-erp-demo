"use client";

import { useState } from "react";
import LaborActivitiesTab from "./LaborActivitiesTab";
import NutriActivitiesTab from "./NutriActivitiesTab";
import FeedingTab from "./FeedingTab";
import LaborLogsTab from "./LaborLogsTab";

type OpsTab = "activities" | "nutriActivities" | "feeding" | "laborLogs";

const TABS: { id: OpsTab; label: string }[] = [
  { id: "activities", label: "Labor Activities" },
  { id: "laborLogs", label: "Labor Logs" },
  { id: "nutriActivities", label: "Nutri Activities" },
  { id: "feeding", label: "Feeding" },
];

export default function OperationsView() {
  const [activeTab, setActiveTab] = useState<OpsTab>("activities");

  return (
    <div>
      {/* Horizontal tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === "feeding"
                    ? "border-teal-500 text-teal-600"
                    : tab.id === "laborLogs"
                    ? "border-indigo-500 text-indigo-600"
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
      {activeTab === "activities" && <LaborActivitiesTab />}
      {activeTab === "laborLogs" && <LaborLogsTab />}
      {activeTab === "nutriActivities" && <NutriActivitiesTab />}
      {activeTab === "feeding" && <FeedingTab />}
    </div>
  );
}
