import { ROLE_HIERARCHY, UserRole, type UserRoleType } from "./roles";

/**
 * Determines if a user role should see all farms (no restrictions)
 * AUDITOR and ADMIN bypass farm restrictions.
 */
export function canSeeAllFarms(role: string): boolean {
  const roleLevel = ROLE_HIERARCHY[role as UserRoleType];
  if (!roleLevel) return false;

  // AUDITOR (1) and ADMIN (5) see all farms
  return role === UserRole.AUDITOR || role === UserRole.ADMIN;
}

/**
 * Returns the list of farm names that a user has access to.
 * - AUDITOR/ADMIN: returns null (meaning "all farms")
 * - Others: returns array with their assigned farm name (or empty array if none)
 */
export function getAccessibleFarms(
  role: string,
  assignedFarmName: string | null | undefined
): string[] | null {
  if (canSeeAllFarms(role)) {
    return null; // null = "all farms"
  }

  // FARM_MANAGER and below: restricted to assigned farm
  return assignedFarmName ? [assignedFarmName] : [];
}

/**
 * Filters a list of farm names based on user's access.
 * Returns the filtered list, or the original list if user can see all farms.
 */
export function filterFarmsByAccess(
  allFarms: string[],
  role: string,
  assignedFarmName: string | null | undefined
): string[] {
  const accessible = getAccessibleFarms(role, assignedFarmName);

  // null means "all farms"
  if (accessible === null) {
    return allFarms;
  }

  // Filter to only accessible farms
  return allFarms.filter((farm) => accessible.includes(farm));
}
