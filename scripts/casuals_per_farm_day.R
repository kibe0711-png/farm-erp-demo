# Casuals per farm per day — pulled from Neon PostgreSQL
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

# ── Query: unique casuals per farm per day ──
df <- dbGetQuery(con, "
  SELECT
    farm,
    date,
    COUNT(DISTINCT casual_worker_id) AS unique_casuals,
    COUNT(*)                         AS total_entries,
    SUM(amount)                      AS total_cost
  FROM attendance_records
  GROUP BY farm, date
  ORDER BY date DESC, farm
")

dbDisconnect(con)

# ── Preview ──
cat("=== Unique Casuals Per Farm Per Day ===\n\n")
print(head(df, 30))

# ── Summary stats per farm ──
cat("\n=== Farm Summary (avg casuals/day) ===\n\n")
farm_summary <- df %>%
  group_by(farm) %>%
  summarise(
    days_recorded    = n(),
    avg_casuals_day  = round(mean(unique_casuals), 1),
    max_casuals_day  = max(unique_casuals),
    min_casuals_day  = min(unique_casuals),
    total_cost       = sum(total_cost),
    .groups = "drop"
  ) %>%
  arrange(desc(avg_casuals_day))

print(farm_summary)

# ── Optional: pivot wide (farms as columns, dates as rows) ──
cat("\n=== Wide Format (casuals by date x farm) ===\n\n")
wide <- df %>%
  select(date, farm, unique_casuals) %>%
  pivot_wider(names_from = farm, values_from = unique_casuals, values_fill = 0) %>%
  arrange(desc(date))

print(head(wide, 20))

# ── Save to CSV ──
output_path <- file.path(Sys.getenv("HOME"), "Downloads", "casuals_per_farm_day.csv")
write.csv(df, output_path, row.names = FALSE)
cat(paste0("\nSaved to: ", output_path, "\n"))
