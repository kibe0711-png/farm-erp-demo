// ── Role definitions ─────────────────────────────────────────────
// 5-tier hierarchy (AUDITOR is lowest, ADMIN is highest)

export const UserRole = {
  AUDITOR: "AUDITOR",
  FARM_CLERK: "FARM_CLERK",
  FARM_SUPERVISOR: "FARM_SUPERVISOR",
  FARM_MANAGER: "FARM_MANAGER",
  ADMIN: "ADMIN",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const ROLE_HIERARCHY: Record<UserRoleType, number> = {
  AUDITOR: 1,
  FARM_CLERK: 2,
  FARM_SUPERVISOR: 3,
  FARM_MANAGER: 4,
  ADMIN: 5,
};

export const ROLE_LABELS: Record<UserRoleType, string> = {
  AUDITOR: "Auditor",
  FARM_CLERK: "Farm Clerk",
  FARM_SUPERVISOR: "Farm Supervisor",
  FARM_MANAGER: "Farm Manager",
  ADMIN: "Admin",
};

// ── Permission definitions ───────────────────────────────────────

export const Permission = {
  // View (read-only)
  VIEW_LABOR: "VIEW_LABOR",
  VIEW_NUTRITION: "VIEW_NUTRITION",
  VIEW_HARVEST: "VIEW_HARVEST",
  VIEW_GANTT: "VIEW_GANTT",
  VIEW_REPORTS: "VIEW_REPORTS",
  VIEW_CROPS: "VIEW_CROPS",

  // Entry (create/record)
  ENTRY_LABOR: "ENTRY_LABOR",
  ENTRY_NUTRITION: "ENTRY_NUTRITION",
  ENTRY_HARVEST: "ENTRY_HARVEST",

  // Edit & approval
  EDIT_GANTT: "EDIT_GANTT",
  EDIT_PAST_RECORDS: "EDIT_PAST_RECORDS",
  APPROVE_FEEDINGS: "APPROVE_FEEDINGS",

  // Admin
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_FARMS: "MANAGE_FARMS",
  MANAGE_CROPS: "MANAGE_CROPS",
  EXPORT_DATA: "EXPORT_DATA",
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

// ── Role → Permission matrix ─────────────────────────────────────
// Each role inherits all permissions from the roles below it.

const AUDITOR_PERMS: PermissionType[] = [
  Permission.VIEW_LABOR,
  Permission.VIEW_NUTRITION,
  Permission.VIEW_HARVEST,
  Permission.VIEW_GANTT,
  Permission.VIEW_REPORTS,
  Permission.VIEW_CROPS,
];

const FARM_CLERK_PERMS: PermissionType[] = [
  ...AUDITOR_PERMS,
  Permission.ENTRY_LABOR,
  Permission.ENTRY_NUTRITION,
  Permission.ENTRY_HARVEST,
];

const FARM_SUPERVISOR_PERMS: PermissionType[] = [
  ...FARM_CLERK_PERMS,
  Permission.EDIT_GANTT,
];

const FARM_MANAGER_PERMS: PermissionType[] = [
  ...FARM_SUPERVISOR_PERMS,
  Permission.APPROVE_FEEDINGS,
  Permission.EDIT_PAST_RECORDS,
  Permission.EXPORT_DATA,
  Permission.MANAGE_CROPS,
];

const ALL_PERMS: PermissionType[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<UserRoleType, PermissionType[]> = {
  AUDITOR: AUDITOR_PERMS,
  FARM_CLERK: FARM_CLERK_PERMS,
  FARM_SUPERVISOR: FARM_SUPERVISOR_PERMS,
  FARM_MANAGER: FARM_MANAGER_PERMS,
  ADMIN: ALL_PERMS,
};

// ── Permission check functions ───────────────────────────────────

export function hasPermission(role: string, permission: PermissionType): boolean {
  const perms = ROLE_PERMISSIONS[role as UserRoleType];
  if (!perms) return false;
  return perms.includes(permission);
}

export function hasAnyPermission(role: string, permissions: PermissionType[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: string, permissions: PermissionType[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getUserPermissions(role: string): PermissionType[] {
  return ROLE_PERMISSIONS[role as UserRoleType] ?? [];
}

// ── Role hierarchy helpers ───────────────────────────────────────

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role as UserRoleType] ?? 0;
}

export function isRoleAtLeast(role: string, minimumRole: UserRoleType): boolean {
  return getRoleLevel(role) >= ROLE_HIERARCHY[minimumRole];
}

export function canPromote(actorRole: string, targetRole: string): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

export const ALL_ROLES = Object.values(UserRole);
