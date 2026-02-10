"use client";

import { useState } from "react";
import PhasesTab from "./PhasesTab";
import GeneralPhasesTab from "./GeneralPhasesTab";

type PhasesSubTab = "farmPhases" | "general";

const TABS: { id: PhasesSubTab; label: string }[] = [
  { id: "farmPhases", label: "Farm Phases" },
  { id: "general", label: "General" },
];

export default function PhasesView() {
  const [activeTab, setActiveTab] = useState<PhasesSubTab>("farmPhases");

  return (
    <div>
      {/* Horizontal sub-tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === "general"
                    ? "border-purple-500 text-purple-600"
                    : "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "farmPhases" && <PhasesTab />}
      {activeTab === "general" && <GeneralPhasesTab />}
    </div>
  );
}
