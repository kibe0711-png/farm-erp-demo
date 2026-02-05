"use client";

import { useState } from "react";
import { DashboardProvider } from "./DashboardContext";
import { AnalyticsProvider } from "../analytics/AnalyticsProvider";
import Sidebar, { type SidebarTab } from "./Sidebar";
import PhasesTab from "./tabs/PhasesTab";
import LaborSopTab from "./tabs/LaborSopTab";
import NutriSopTab from "./tabs/NutriSopTab";
import KeyInputsTab from "./tabs/KeyInputsTab";
import OperationsView from "./tabs/OperationsView";
import IPPView from "./tabs/IPPView";
import GuideView from "./tabs/GuideView";
import FarmSettingsTab from "./tabs/FarmSettingsTab";
import UsersManagement from "./tabs/UsersManagement";
import AnalyticsView from "./tabs/AnalyticsView";

export default function DashboardShell() {
  const [activeSection, setActiveSection] = useState<SidebarTab>("phases");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <DashboardProvider>
      <AnalyticsProvider currentPage={activeSection}>
        <div className="flex min-h-screen">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main
            className={`flex-1 bg-gray-50 p-8 transition-all duration-300 ${
              sidebarCollapsed ? "ml-16" : "ml-64"
            }`}
          >
            {activeSection === "phases" && <PhasesTab />}
            {activeSection === "labor" && <LaborSopTab />}
            {activeSection === "nutri" && <NutriSopTab />}
            {activeSection === "keyInputs" && <KeyInputsTab />}
            {activeSection === "operations" && <OperationsView />}
            {activeSection === "ipp" && <IPPView />}
            {activeSection === "guide" && <GuideView />}
            {activeSection === "settings" && <FarmSettingsTab />}
            {activeSection === "users" && <UsersManagement />}
            {activeSection === "analytics" && <AnalyticsView />}
          </main>
        </div>
      </AnalyticsProvider>
    </DashboardProvider>
  );
}
