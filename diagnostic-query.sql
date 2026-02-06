-- Diagnostic queries to check harvest data linkage
-- Run these in Neon SQL Editor (https://console.neon.tech)

-- 1. Check harvest_logs count and date range
SELECT
  COUNT(*) as total_logs,
  MIN(log_date) as earliest_log,
  MAX(log_date) as latest_log,
  COUNT(DISTINCT farm_phase_id) as unique_phases
FROM harvest_logs;

-- 2. Check harvest_schedules count and date range
SELECT
  COUNT(*) as total_schedules,
  MIN(week_start_date) as earliest_week,
  MAX(week_start_date) as latest_week,
  COUNT(DISTINCT farm_phase_id) as unique_phases
FROM harvest_schedules;

-- 3. Check if farmPhaseIds match between tables
SELECT
  'Only in logs' as status,
  COUNT(DISTINCT hl.farm_phase_id) as count
FROM harvest_logs hl
LEFT JOIN harvest_schedules hs ON hl.farm_phase_id = hs.farm_phase_id
WHERE hs.farm_phase_id IS NULL

UNION ALL

SELECT
  'Only in schedules' as status,
  COUNT(DISTINCT hs.farm_phase_id) as count
FROM harvest_schedules hs
LEFT JOIN harvest_logs hl ON hs.farm_phase_id = hl.farm_phase_id
WHERE hl.farm_phase_id IS NULL

UNION ALL

SELECT
  'In both tables' as status,
  COUNT(DISTINCT hl.farm_phase_id) as count
FROM harvest_logs hl
INNER JOIN harvest_schedules hs ON hl.farm_phase_id = hs.farm_phase_id;

-- 4. Sample of actual data (first 5 rows from each table)
SELECT 'LOGS' as source, id, farm_phase_id, log_date, actual_kg, grade1_kg, grade2_kg
FROM harvest_logs
ORDER BY log_date DESC
LIMIT 5;

SELECT 'SCHEDULES' as source, id, farm_phase_id, week_start_date, day_of_week, pledge_kg, NULL::decimal as grade1_kg, NULL::decimal as grade2_kg
FROM harvest_schedules
ORDER BY week_start_date DESC
LIMIT 5;

-- 5. Check for week 2026-02-03 specifically (current week from your screenshot)
SELECT
  'Logs in week 2026-02-03' as check_type,
  COUNT(*) as count,
  SUM(actual_kg) as total_kg
FROM harvest_logs
WHERE log_date >= '2026-02-03' AND log_date <= '2026-02-09';

SELECT
  'Schedules for week 2026-02-03' as check_type,
  COUNT(*) as count,
  SUM(pledge_kg) as total_kg
FROM harvest_schedules
WHERE week_start_date = '2026-02-03';
