# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — start Next.js dev server (port 3000)
- `npm run build` — production build (runs `prisma generate` first)
- `npm run lint` — ESLint with flat config (`eslint.config.mjs`)
- No test suite currently configured

## Stack

- **Next.js 16** App Router, **React 19**, **TypeScript 5** (strict)
- **Tailwind CSS 4** with PostCSS
- **Prisma 7.2** with PrismaPg adapter → PostgreSQL (Neon)
- **JWT auth** via `jose` + httpOnly cookies (24h expiry)
- **jsPDF** for client-side PDF generation
- **PapaParse** for CSV parsing
- Path alias: `@/*` maps to project root

## Architecture

### Dashboard Tab System

The main UI is a sidebar-driven tab system:

1. `Sidebar.tsx` defines `SidebarTab` union type and renders navigation
2. `DashboardShell.tsx` maps `activeSection` to tab components
3. `DashboardContext.tsx` provides global state via React Context (phases, SOPs, farms, user, week selection, all fetch/mutation functions)

**Adding a new tab requires three changes:**
- Add to `SidebarTab` union type in `Sidebar.tsx`
- Add sidebar button in the appropriate section
- Import component and add render branch in `DashboardShell.tsx`

Sidebar sections: DATA UPLOAD → OPERATIONS → PLANNING → GUIDE → SETTINGS → ADMIN

**OperationsView** is a sub-tabbed interface with 6 horizontal tabs: Compliance, Labor Activities, Labor Logs, Nutri Activities, Feeding, Harvesting.

### Auth & RBAC

5-tier role hierarchy defined in `lib/auth/roles.ts`:
```
AUDITOR (1) → FARM_CLERK (2) → FARM_SUPERVISOR (3) → FARM_MANAGER (4) → ADMIN (5)
```

Each role inherits all permissions from roles below it. 16 permissions across VIEW, ENTRY, EDIT, and ADMIN categories. Auth is checked per-route using `getAuthUser()` + `hasPermission()` — no middleware file.

Session invalidation uses a `tokenVersion` counter on the User model.

### API Route Patterns

All data routes under `/api/*` follow REST conventions. Most support:
- GET (read), POST (single object or bulk array from CSV), PATCH (update by id), DELETE (single by id or bulk)

CSV upload routes accept multiple field name variants (snake_case, camelCase).

Protected routes call `getAuthUser()` and check permissions before proceeding.

### Data Model

Core entity is `FarmPhase` (cropCode, phaseId, sowingDate, farm, areaHa). Downstream entities link via `farmPhaseId`:
- Schedules: LaborSchedule, NutriSchedule, HarvestSchedule (compound unique on phase+sop+week+day)
- Logs: LaborLog, FeedingRecord, HarvestLog
- Overrides: PhaseActivityOverride (add/remove activities per phase per week)

SOPs (LaborSop, NutriSop) are matched at runtime by `cropCode + weeksSinceSowing`.

`CropKeyInput` stores IPP parameters: nurseryDays, outgrowingDays, yieldPerHa, harvestWeeks, rejectRate, wk1–wk16 (percentage distributions).

### Key Calculations

**weeksSinceSowing**: `calculateWeeksSinceSowing()` in DashboardContext normalizes DB dates (UTC) and local-time Mondays to calendar dates before comparing. This is critical — `getMondayOfWeek()` returns local-time dates for DB schedule compatibility.

**IPP forecast**: `areaHa × yieldPerHa × (wk[N] / 100) × (1 − rejectRate / 100)` where harvest starts at `sowingDate + nurseryDays + outgrowingDays`. Units are tons.

**Activity matching**: Labor/Nutri Activities tabs compute activities on-the-fly by matching `cropCode + weeksSinceSowing` against SOPs. Compliance reads from saved schedule records in the DB.

## Conventions

- Guide content (`GuideView.tsx`) is written in **Kinyarwanda**, scoped to Farm Clerk and Farm Manager roles only
- Report APIs (`/api/reports/*`) are protected by `x-api-key` header (`REPORT_API_KEY` env var) for n8n/Twilio integration
- Decimal precision: `Decimal(10,2)` for costs, `Decimal(10,4)` for rates/areas
- Farm records are auto-created via upsert when a new farm name appears in phase data
- Phases API returns max 100 records ordered by `createdAt DESC`
