"use client";

import { useDashboard } from "./DashboardContext";

export type SidebarTab = "phases" | "labor" | "nutri" | "operations";

interface SidebarProps {
  activeSection: SidebarTab;
  onSectionChange: (section: SidebarTab) => void;
}

const DATA_ITEMS: { id: SidebarTab; label: string }[] = [
  { id: "phases", label: "Farm Phases" },
  { id: "labor", label: "Labor SOP" },
  { id: "nutri", label: "Nutri SOP" },
];

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { handleLogout } = useDashboard();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo / Title */}
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Farm Data Manager</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {/* Data Upload group */}
        <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-2 mb-2 tracking-wider">
          Data Upload
        </p>
        {DATA_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
              activeSection === item.id
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            style={{ width: "calc(100% - 16px)" }}
          >
            {item.label}
          </button>
        ))}

        {/* Operations */}
        <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-6 mb-2 tracking-wider">
          Operations
        </p>
        <button
          onClick={() => onSectionChange("operations")}
          className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
            activeSection === "operations"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          style={{ width: "calc(100% - 16px)" }}
        >
          Operations
        </button>
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
