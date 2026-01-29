"use client";

import { useState } from "react";
import { DashboardProvider } from "./DashboardContext";
import Sidebar, { type SidebarTab } from "./Sidebar";
import PhasesTab from "./tabs/PhasesTab";
import LaborSopTab from "./tabs/LaborSopTab";
import NutriSopTab from "./tabs/NutriSopTab";
import OperationsView from "./tabs/OperationsView";
import FarmSettingsTab from "./tabs/FarmSettingsTab";
import UsersManagement from "./tabs/UsersManagement";

export default function DashboardShell() {
  const [activeSection, setActiveSection] = useState<SidebarTab>("phases");

  return (
    <DashboardProvider>
      <div className="flex min-h-screen">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="ml-64 flex-1 bg-gray-50 p-8">
          {activeSection === "phases" && <PhasesTab />}
          {activeSection === "labor" && <LaborSopTab />}
          {activeSection === "nutri" && <NutriSopTab />}
          {activeSection === "operations" && <OperationsView />}
          {activeSection === "settings" && <FarmSettingsTab />}
          {activeSection === "users" && <UsersManagement />}
        </main>
      </div>
    </DashboardProvider>
  );
}
