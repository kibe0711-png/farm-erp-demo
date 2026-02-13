/**
 * Seed script: Import activity rates from 3 farm cluster CSVs.
 *
 * Usage: npx tsx scripts/seed-activity-rates.ts
 *
 * - Parses comma-formatted rates ("3,000" -> 3000)
 * - Auto-detects rateType: harvesting activities = "per_kg", others = "daily"
 * - Links to Farm model via farmId
 * - Uses upsert on (activity, farm) to avoid duplicates on re-run
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const CLUSTERS_DIR = "/Users/moseskibekaranja/Downloads/Casuals upload/Clusters";

const FILES = [
  { file: "Cluster Gatsibo.csv", farmNormalized: "Gatsibo" },
  { file: "Cluster Mulindi.csv", farmNormalized: "Mulindi" },
  { file: "Cluster Musha.csv", farmNormalized: "Musha" },
];

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const fields: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && content[i + 1] === "\n") i++;
        fields.push(current);
        current = "";
        if (fields.some((f) => f.trim())) rows.push(fields.slice());
        fields.length = 0;
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  if (fields.some((f) => f.trim())) rows.push(fields.slice());

  return rows;
}

function parseRate(raw: string): number {
  // Remove commas from formatted numbers like "3,000"
  const cleaned = raw.trim().replace(/,/g, "");
  return parseFloat(cleaned) || 0;
}

function detectRateType(activity: string, rate: number): string {
  const lower = activity.toLowerCase();
  // Harvesting activities have per-kg rates (typically < 200 RWF)
  // Sorting is also per-kg
  if (lower.startsWith("harvesting") || lower === "sorting") {
    return "per_kg";
  }
  return "daily";
}

async function main() {
  const farms = await prisma.farm.findMany({ select: { id: true, name: true } });
  const farmMap = new Map(farms.map((f) => [f.name.toLowerCase(), f.id]));

  console.log(`Found ${farms.length} farms in DB: ${farms.map((f) => f.name).join(", ")}`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const config of FILES) {
    const filePath = path.join(CLUSTERS_DIR, config.file);
    const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
    const rows = parseCSV(content);

    // Skip header
    const dataRows = rows.slice(1);
    console.log(`\n--- ${config.file}: ${dataRows.length} data rows ---`);

    const farmId = farmMap.get(config.farmNormalized.toLowerCase()) || null;
    if (!farmId) {
      console.log(`  WARNING: Farm "${config.farmNormalized}" not found in DB.`);
    } else {
      console.log(`  Linked to Farm ID ${farmId} (${config.farmNormalized})`);
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of dataRows) {
      // Columns: No, Activity, Rate, Farm
      const activity = (row[1] || "").trim();
      const rateStr = (row[2] || "").trim();

      if (!activity || !rateStr) {
        skipped++;
        continue;
      }

      const rate = parseRate(rateStr);
      if (rate === 0) {
        skipped++;
        continue;
      }

      const rateType = detectRateType(activity, rate);

      try {
        await prisma.activityRate.upsert({
          where: {
            activity_farm: {
              activity,
              farm: config.farmNormalized,
            },
          },
          create: {
            activity,
            rate,
            rateType,
            farm: config.farmNormalized,
            farmId,
          },
          update: {
            rate,
            rateType,
          },
        });
        inserted++;
        console.log(`  ${activity}: ${rate} RWF (${rateType})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  Error inserting "${activity}": ${msg}`);
        skipped++;
      }
    }

    console.log(`  Total: ${inserted} inserted/updated, ${skipped} skipped`);
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log(`\n=== TOTAL: ${totalInserted} inserted/updated, ${totalSkipped} skipped ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
