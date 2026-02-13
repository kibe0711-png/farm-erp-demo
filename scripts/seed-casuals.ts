/**
 * Seed script: Import casual workers from 3 farm CSVs into the database.
 *
 * Usage: npx tsx scripts/seed-casuals.ts
 *
 * - Normalizes phone numbers to E.164 (+250...)
 * - Normalizes farm names to title case matching existing Farm records
 * - Links each worker to their Farm via farmId
 * - Skips rows with empty names
 * - Uses upsert on (name, farm) to avoid duplicates on re-run
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CASUALS_DIR = "/Users/moseskibekaranja/Downloads/Casuals upload/Casuals DB's";

// CSV file configs: each has slightly different column headers
const FILES = [
  {
    file: "Gatsibo casuals DB.csv",
    nameCol: 1,  // "GATSIBO FARM"
    idCol: 2,    // "ID number"
    phoneCol: 3, // "Phone no"
    farmCol: 4,  // "Farm"
    farmNormalized: "Gatsibo",
  },
  {
    file: "Mulindi casuals DB.csv",
    nameCol: 1,  // "NAMES"
    idCol: 2,    // "ID"
    phoneCol: 3, // "TELEPHONE NO"
    farmCol: 4,  // "FARM"
    farmNormalized: "Mulindi",
  },
  {
    file: "Musha casuals DB.csv",
    nameCol: 1,  // "Casuals database"
    idCol: 2,    // "ID number"
    phoneCol: 3, // "Phone number"
    farmCol: 4,  // "Farm"
    farmNormalized: "Musha",
  },
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
  // Last row
  fields.push(current);
  if (fields.some((f) => f.trim())) rows.push(fields.slice());

  return rows;
}

function normalizePhone(raw: string): string | null {
  let phone = raw.trim().replace(/['\s-]/g, "");
  if (!phone) return null;

  // Already has +250
  if (phone.startsWith("+250")) {
    const digits = phone.slice(4);
    return digits.length >= 8 ? phone : null;
  }

  // Has 250 prefix (12 digits total)
  if (phone.startsWith("250") && phone.length >= 12) {
    return "+" + phone;
  }

  // 9-digit local number
  if (phone.length === 9 && /^\d{9}$/.test(phone)) {
    return "+250" + phone;
  }

  // 10-digit starting with 0
  if (phone.startsWith("0") && phone.length === 10) {
    return "+250" + phone.slice(1);
  }

  // Fallback: just prepend +250 if it looks numeric
  if (/^\d+$/.test(phone)) {
    return "+250" + phone;
  }

  return phone; // return as-is if weird format
}

async function main() {
  // Get existing farms for linking
  const farms = await prisma.farm.findMany({ select: { id: true, name: true } });
  const farmMap = new Map(farms.map((f) => [f.name.toLowerCase(), f.id]));

  console.log(`Found ${farms.length} farms in DB: ${farms.map((f) => f.name).join(", ")}`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const config of FILES) {
    const filePath = path.join(CASUALS_DIR, config.file);
    const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, ""); // strip BOM
    const rows = parseCSV(content);

    // Skip header row
    const dataRows = rows.slice(1);
    console.log(`\n--- ${config.file}: ${dataRows.length} rows ---`);

    const farmId = farmMap.get(config.farmNormalized.toLowerCase()) || null;
    if (!farmId) {
      console.log(`  WARNING: Farm "${config.farmNormalized}" not found in DB. Will insert without farmId.`);
    } else {
      console.log(`  Linked to Farm ID ${farmId} (${config.farmNormalized})`);
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const name = (row[config.nameCol] || "").trim();
      if (!name) {
        skipped++;
        continue;
      }

      const nationalId = (row[config.idCol] || "").trim() || null;
      const rawPhone = (row[config.phoneCol] || "").trim();
      const phone = normalizePhone(rawPhone);

      try {
        await prisma.casualWorker.upsert({
          where: {
            name_farm: {
              name,
              farm: config.farmNormalized,
            },
          },
          create: {
            name,
            nationalId,
            phone,
            farm: config.farmNormalized,
            farmId,
          },
          update: {
            nationalId,
            phone,
          },
        });
        inserted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  Error inserting "${name}": ${msg}`);
        skipped++;
      }
    }

    console.log(`  Inserted/updated: ${inserted}, Skipped: ${skipped}`);
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log(`\n=== TOTAL: ${totalInserted} inserted/updated, ${totalSkipped} skipped ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
