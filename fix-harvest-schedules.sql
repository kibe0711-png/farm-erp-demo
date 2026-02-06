-- Fix harvest_schedules: Convert Sunday weekStartDate to Monday
-- This fixes the Performance view missing Monday pledges

-- Check before migration
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN EXTRACT(DOW FROM week_start_date) = 0 THEN 1 END) as sunday_dates_to_fix,
  COUNT(CASE WHEN EXTRACT(DOW FROM week_start_date) = 1 THEN 1 END) as monday_dates_already_correct
FROM harvest_schedules;

-- Apply fix: Add 1 day to Sunday dates to make them Monday
UPDATE harvest_schedules
SET week_start_date = week_start_date + INTERVAL '1 day'
WHERE EXTRACT(DOW FROM week_start_date) = 0;

-- Verify after migration (should show 0 Sunday dates)
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN EXTRACT(DOW FROM week_start_date) = 0 THEN 1 END) as sunday_dates_remaining,
  COUNT(CASE WHEN EXTRACT(DOW FROM week_start_date) = 1 THEN 1 END) as monday_dates_now
FROM harvest_schedules;
