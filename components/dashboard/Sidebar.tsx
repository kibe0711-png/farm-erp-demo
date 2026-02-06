"use client";

import Image from "next/image";
import { useDashboard } from "./DashboardContext";
import { ROLE_LABELS, type UserRoleType } from "@/lib/auth/roles";

export type SidebarTab = "phases" | "labor" | "nutri" | "keyInputs" | "operations" | "ipp" | "settings" | "users" | "analytics";

interface SidebarProps {
  activeSection: SidebarTab;
  onSectionChange: (section: SidebarTab) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const DATA_ITEMS: { id: SidebarTab; label: string }[] = [
  { id: "phases", label: "Farm Phases" },
  { id: "labor", label: "Labor SOP" },
  { id: "nutri", label: "Nutri SOP" },
  { id: "keyInputs", label: "Key Inputs" },
];

export default function Sidebar({ activeSection, onSectionChange, collapsed, onToggle }: SidebarProps) {
  const { handleLogout, userName, user } = useDashboard();
  const isAdmin = user?.role === "ADMIN";

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col z-30 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo + Toggle */}
      <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <Image src="/souk-circle.png" alt="Souk FarmIQ" width={36} height={36} priority />
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {/* Data Upload group */}
        {!collapsed && (
          <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-2 mb-2 tracking-wider">
            Data Upload
          </p>
        )}
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
            title={collapsed ? item.label : undefined}
          >
            {collapsed ? item.label.charAt(0) : item.label}
          </button>
        ))}

        {/* Operations */}
        {!collapsed && (
          <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-6 mb-2 tracking-wider">
            Operations
          </p>
        )}
        <button
          onClick={() => onSectionChange("operations")}
          className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
            activeSection === "operations"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          } ${collapsed ? "mt-4" : ""}`}
          style={{ width: "calc(100% - 16px)" }}
          title={collapsed ? "Operations" : undefined}
        >
          {collapsed ? "O" : "Operations"}
        </button>

        {/* Planning */}
        {!collapsed && (
          <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-6 mb-2 tracking-wider">
            Planning
          </p>
        )}
        <button
          onClick={() => onSectionChange("ipp")}
          className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
            activeSection === "ipp"
              ? "bg-emerald-50 text-emerald-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          } ${collapsed ? "mt-4" : ""}`}
          style={{ width: "calc(100% - 16px)" }}
          title={collapsed ? "IPP" : undefined}
        >
          {collapsed ? "I" : "IPP"}
        </button>

        {/* Settings */}
        {!collapsed && (
          <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-6 mb-2 tracking-wider">
            Settings
          </p>
        )}
        <button
          onClick={() => onSectionChange("settings")}
          className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
            activeSection === "settings"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          } ${collapsed ? "mt-4" : ""}`}
          style={{ width: "calc(100% - 16px)" }}
          title={collapsed ? "Farm Settings" : undefined}
        >
          {collapsed ? "S" : "Farm Settings"}
        </button>

        {isAdmin && (
          <>
            {!collapsed && (
              <p className="text-xs uppercase text-gray-400 font-semibold px-4 mt-6 mb-2 tracking-wider">
                Admin
              </p>
            )}
            <button
              onClick={() => onSectionChange("users")}
              className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                activeSection === "users"
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              } ${collapsed ? "mt-4" : ""}`}
              style={{ width: "calc(100% - 16px)" }}
              title={collapsed ? "Users Management" : undefined}
            >
              {collapsed ? "U" : "Users Management"}
            </button>
            <button
              onClick={() => onSectionChange("analytics")}
              className={`flex items-center gap-3 w-full px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                activeSection === "analytics"
                  ? "bg-violet-50 text-violet-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              style={{ width: "calc(100% - 16px)" }}
              title={collapsed ? "Analytics" : undefined}
            >
              {collapsed ? "A" : "Analytics"}
            </button>
          </>
        )}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-200 p-4">
        {userName && !collapsed && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            {user?.role && (
              <p className="text-xs text-gray-500">{ROLE_LABELS[user.role as UserRoleType] ?? user.role}</p>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors ${
            collapsed ? "text-center" : ""
          }`}
          title={collapsed ? "Logout" : undefined}
        >
          {collapsed ? "X" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
