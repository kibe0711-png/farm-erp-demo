-- Safe READ-ONLY queries to check current database status
-- These queries ONLY read data, they do NOT modify anything

-- 1. Count records in harvest_schedules
SELECT 'harvest_schedules' as table_name, COUNT(*) as record_count
FROM harvest_schedules;

-- 2. Count records in harvest_logs
SELECT 'harvest_logs' as table_name, COUNT(*) as record_count
FROM harvest_logs;

-- 3. Count records in farm_phases
SELECT 'farm_phases' as table_name, COUNT(*) as record_count
FROM farm_phases;

-- 4. If harvest_schedules still has data, show sample
SELECT *
FROM harvest_schedules
LIMIT 5;

-- 5. If harvest_logs still has data, show sample
SELECT *
FROM harvest_logs
LIMIT 5;
