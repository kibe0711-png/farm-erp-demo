-- Clear all harvest_schedules data
-- Run this in Neon SQL editor to wipe existing farmer pledge data
-- This does NOT drop the table, only deletes all records

-- Check count before deletion
SELECT COUNT(*) as total_records_before_delete FROM harvest_schedules;

-- Delete all records
DELETE FROM harvest_schedules;

-- Verify deletion
SELECT COUNT(*) as total_records_after_delete FROM harvest_schedules;
