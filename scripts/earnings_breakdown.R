# Earnings & headcount breakdown: per day, per task, per farm
# Install once: install.packages(c("RPostgres", "DBI", "dplyr", "tidyr"))

library(DBI)
library(RPostgres)
library(dplyr)
library(tidyr)

# ── Connect to Neon ──
con <- dbConnect(
  Postgres(),
  host     = "ep-long-field-ah4z9e55-pooler.c-3.us-east-1.aws.neon.tech",
  dbname   = "neondb",
  user     = "neondb_owner",
  password = "npg_hv0WxyLkG5SH",
  port     = 5432,
  sslmode  = "require"
)

# ── Pull all attendance records ──
df <- dbGetQuery(con, "
  SELECT
    a.farm,
    a.date,
    a.activity,
    a.rate_type,
    a.rate,
    a.units,
    a.adjustment,
    a.amount,
    a.casual_worker_id,
    w.name AS worker_name
  FROM attendance_records a
  LEFT JOIN casual_workers w ON w.id = a.casual_worker_id
  ORDER BY a.date DESC, a.farm, a.activity
")

dbDisconnect(con)

cat(paste0("Total records: ", nrow(df), "\n\n"))

# ══════════════════════════════════════════════
# 1. PER DAY PER FARM — earnings + headcount
# ══════════════════════════════════════════════
cat("═══════════════════════════════════════════\n")
cat("  1. PER DAY PER FARM\n")
cat("═══════════════════════════════════════════\n\n")

daily_farm <- df %>%
  group_by(farm, date) %>%
  summarise(
    unique_casuals = n_distinct(casual_worker_id),
    total_entries  = n(),
    earnings_rwf   = sum(amount, na.rm = TRUE),
    adjustments    = sum(adjustment, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  arrange(desc(date), farm)

print(head(daily_farm, 40))

# Wide: earnings by farm
cat("\n--- Daily earnings wide (farms as columns) ---\n\n")
earn_wide <- daily_farm %>%
  select(date, farm, earnings_rwf) %>%
  pivot_wider(names_from = farm, values_from = earnings_rwf, values_fill = 0) %>%
  arrange(desc(date))
print(head(earn_wide, 30))

# Wide: headcount by farm
cat("\n--- Daily headcount wide (farms as columns) ---\n\n")
head_wide <- daily_farm %>%
  select(date, farm, unique_casuals) %>%
  pivot_wider(names_from = farm, values_from = unique_casuals, values_fill = 0) %>%
  arrange(desc(date))
print(head(head_wide, 30))

# ══════════════════════════════════════════════
# 2. PER TASK (ACTIVITY) — all farms combined
# ══════════════════════════════════════════════
cat("\n═══════════════════════════════════════════\n")
cat("  2. PER TASK (ALL FARMS)\n")
cat("═══════════════════════════════════════════\n\n")

task_summary <- df %>%
  group_by(activity) %>%
  summarise(
    unique_casuals = n_distinct(casual_worker_id),
    total_entries  = n(),
    earnings_rwf   = sum(amount, na.rm = TRUE),
    avg_per_entry  = round(mean(amount, na.rm = TRUE), 0),
    days_active    = n_distinct(date),
    .groups = "drop"
  ) %>%
  arrange(desc(earnings_rwf))

print(task_summary)

# ══════════════════════════════════════════════
# 3. PER TASK PER FARM — earnings + headcount
# ══════════════════════════════════════════════
cat("\n═══════════════════════════════════════════\n")
cat("  3. PER TASK PER FARM\n")
cat("═══════════════════════════════════════════\n\n")

task_farm <- df %>%
  group_by(farm, activity) %>%
  summarise(
    unique_casuals = n_distinct(casual_worker_id),
    total_entries  = n(),
    earnings_rwf   = sum(amount, na.rm = TRUE),
    avg_per_entry  = round(mean(amount, na.rm = TRUE), 0),
    days_active    = n_distinct(date),
    .groups = "drop"
  ) %>%
  arrange(farm, desc(earnings_rwf))

print(task_farm, n = 100)

# ══════════════════════════════════════════════
# 4. FULL BREAKDOWN: DAY × TASK × FARM
# ══════════════════════════════════════════════
cat("\n═══════════════════════════════════════════\n")
cat("  4. FULL BREAKDOWN: DAY × TASK × FARM\n")
cat("═══════════════════════════════════════════\n\n")

full_breakdown <- df %>%
  group_by(farm, date, activity) %>%
  summarise(
    unique_casuals = n_distinct(casual_worker_id),
    total_entries  = n(),
    earnings_rwf   = sum(amount, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  arrange(desc(date), farm, desc(earnings_rwf))

print(head(full_breakdown, 60))

# ══════════════════════════════════════════════
# 5. FARM TOTALS
# ══════════════════════════════════════════════
cat("\n═══════════════════════════════════════════\n")
cat("  5. FARM TOTALS\n")
cat("═══════════════════════════════════════════\n\n")

farm_totals <- df %>%
  group_by(farm) %>%
  summarise(
    total_earnings    = sum(amount, na.rm = TRUE),
    total_adjustments = sum(adjustment, na.rm = TRUE),
    unique_casuals    = n_distinct(casual_worker_id),
    total_entries     = n(),
    days_active       = n_distinct(date),
    unique_tasks      = n_distinct(activity),
    avg_daily_spend   = round(sum(amount, na.rm = TRUE) / n_distinct(date), 0),
    avg_daily_casuals = round(n() / n_distinct(date), 0),
    .groups = "drop"
  ) %>%
  arrange(desc(total_earnings))

print(farm_totals)

# ══════════════════════════════════════════════
# 6. SAVE CSVs
# ══════════════════════════════════════════════
dl <- file.path(Sys.getenv("HOME"), "Downloads")

write.csv(daily_farm, file.path(dl, "earnings_per_day_farm.csv"), row.names = FALSE)
write.csv(task_summary, file.path(dl, "earnings_per_task.csv"), row.names = FALSE)
write.csv(task_farm, file.path(dl, "earnings_per_task_farm.csv"), row.names = FALSE)
write.csv(full_breakdown, file.path(dl, "earnings_full_breakdown.csv"), row.names = FALSE)
write.csv(farm_totals, file.path(dl, "earnings_farm_totals.csv"), row.names = FALSE)

cat("\n── CSVs saved to ~/Downloads/ ──\n")
cat("  earnings_per_day_farm.csv\n")
cat("  earnings_per_task.csv\n")
cat("  earnings_per_task_farm.csv\n")
cat("  earnings_full_breakdown.csv\n")
cat("  earnings_farm_totals.csv\n")
