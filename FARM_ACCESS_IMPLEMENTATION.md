# Farm-Based Access Control Implementation

## Overview

Users are now assigned to farms based on their role:
- **AUDITOR** and **ADMIN**: See ALL farms (no restrictions)
- **FARM_MANAGER, FARM_SUPERVISOR, FARM_CLERK**: Only see their assigned farm

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)

Added farm assignment to User model:

```prisma
model User {
  id              Int      @id @default(autoincrement())
  email           String   @unique @db.VarChar(255)
  name            String   @db.VarChar(100)
  password        String   @db.Text
  role            String   @default("FARM_CLERK") @db.VarChar(30)
  status          String   @default("ACTIVE") @db.VarChar(20)
  tokenVersion    Int      @default(0) @map("token_version")
  assignedFarmId  Int?     @map("assigned_farm_id")   // NEW
  assignedFarm    Farm?    @relation(fields: [assignedFarmId], references: [id])  // NEW
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("users")
}

model Farm {
  // ... existing fields
  users           User[]   // NEW - reverse relation
}
```

### 2. Authentication Updates

**`lib/auth/getAuthUser.ts`**
- Now returns `assignedFarmId` and `assignedFarm` info

**`app/api/auth/me/route.ts`**
- Returns `assignedFarmId` and `assignedFarmName` in response

### 3. Farm Access Helper (`lib/auth/farmAccess.ts`)

New utility functions:
- `canSeeAllFarms(role)` - Returns true for AUDITOR and ADMIN
- `getAccessibleFarms(role, assignedFarmName)` - Returns farm list or null (all farms)
- `filterFarmsByAccess(allFarms, role, assignedFarmName)` - Filters farm list

### 4. Dashboard Context Updates

**`components/dashboard/DashboardContext.tsx`**
- Updated `AuthUser` interface to include:
  - `assignedFarmId: number | null`
  - `assignedFarmName: string | null`
- Modified `fetchPhases()` to filter phases by assigned farm
- Reordered useEffect hooks to fetch user first, then data

### 5. Admin API Updates

**`app/api/admin/users/route.ts`**
- **GET**: Returns `assignedFarmId` and `assignedFarm.name` for each user
- **PATCH**: Accepts `assignedFarmId` parameter to assign/unassign farms
- Invalidates session (`tokenVersion++`) when farm assignment changes

## Required Steps to Complete

### Step 1: Database Migration

Run these commands to sync the database:

```bash
npx prisma db push
npx prisma generate
```

This will:
1. Add `assigned_farm_id` column to `users` table
2. Create foreign key constraint to `farms` table
3. Regenerate Prisma Client with new types

### Step 2: Build & Test

After running Prisma commands, all TypeScript errors will resolve:

```bash
npm run build
```

### Step 3: Assign Farms to Users

Admins can now assign farms via PATCH request:

```bash
# Assign Farm Manager to "Rwamagana Farm"
curl -X PATCH http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": 2,
    "assignedFarmId": 1
  }'

# Unassign farm
curl -X PATCH http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": 2,
    "assignedFarmId": null
  }'
```

## Behavior

### For AUDITOR/ADMIN:
- Dashboard shows ALL farms
- Compliance tab shows all farm cards
- No filtering applied

### For FARM_MANAGER/SUPERVISOR/CLERK:
- Dashboard shows ONLY assigned farm's phases
- If `assignedFarmId` is NULL, they see NO data
- Compliance tab shows only their farm
- All data (logs, schedules, etc.) filtered by farm

## Next Steps (Optional)

1. **UI for Farm Assignment**: Add dropdown in Admin User Management to assign farms
2. **Validation**: Prevent assigning farms to AUDITOR/ADMIN roles (they don't need it)
3. **Bulk Assignment**: Allow CSV import to assign multiple users at once
4. **Farm Dashboard**: Show which users are assigned to each farm

## Testing Checklist

- [ ] Run `npx prisma db push && npx prisma generate`
- [ ] Build passes without TypeScript errors
- [ ] ADMIN user sees all farms
- [ ] AUDITOR user sees all farms
- [ ] FARM_MANAGER with assigned farm sees only that farm
- [ ] FARM_CLERK with no assigned farm sees empty dashboard
- [ ] Farm assignment via PATCH endpoint works
- [ ] Session invalidates when farm changes (user must re-login)
- [ ] Compliance tab respects farm access
