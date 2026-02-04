"use client";

import { useState, useEffect, useCallback } from "react";
import { ALL_ROLES, ROLE_LABELS, type UserRoleType } from "@/lib/auth/roles";

interface UserItem {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  FARM_MANAGER: "bg-blue-100 text-blue-700",
  FARM_SUPERVISOR: "bg-purple-100 text-purple-700",
  FARM_CLERK: "bg-green-100 text-green-700",
  AUDITOR: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  SUSPENDED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

export default function UsersManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      } else {
        setError("Failed to load users");
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const startEdit = (user: UserItem) => {
    setEditingId(user.id);
    setEditRole(user.role);
    setEditStatus(user.status);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, role: editRole, status: editStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setEditingId(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update user");
      }
    } catch {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const approveUser = async (userId: number) => {
    setApprovingId(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, status: "ACTIVE" }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to approve user");
      }
    } catch {
      setError("Failed to approve user");
    } finally {
      setApprovingId(null);
    }
  };

  const pendingUsers = users.filter((u) => u.status === "PENDING");

  if (loading) {
    return <div className="text-sm text-gray-500 py-8 text-center">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Users Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage user roles and account status. Changes take effect on their next login.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Pending Approvals Section */}
      {pendingUsers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-3">
            Pending Approvals ({pendingUsers.length})
          </h3>
          <div className="space-y-2">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-yellow-200"
              >
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveUser(user.id)}
                    disabled={approvingId === user.id}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {approvingId === user.id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => startEdit(user)}
                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-200"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Joined</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{user.name}</td>
                  <td className="py-3 px-4 text-gray-600">{user.email}</td>
                  <td className="py-3 px-4">
                    {editingId === user.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r as UserRoleType]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role as UserRoleType] ?? user.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingId === user.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {user.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {editingId === user.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(user)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
