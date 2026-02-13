import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const SOP_DIR = "/Users/moseskibekaranja/Downloads/Karakuta SOP";
const OUTPUT = path.join(require("os").homedir(), "Downloads", "Karakuta_Budget.xlsx");
const PRICE_PER_KG = 350; // KES

// ─── CSV parser (handles quoted commas) ───
function parseCSV(filePath: string): string[][] {
  const text = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    const cells: string[] = [];
    let cell = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cells.push(cell.trim()); cell = ""; continue; }
      if (ch === "\r") continue;
      cell += ch;
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

function num(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const mon = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
      .indexOf(m[2].toLowerCase());
    let yr = parseInt(m[3]);
    if (yr < 100) yr += 2000;
    if (mon >= 0) return new Date(yr, mon, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}



// ─── 1. Parse blocks ───
interface Block {
  cropCode: string;
  block: string;
  sowingDate: Date;
  sizeHa: number;
}

function parseBlocks(): Block[] {
  const rows = parseCSV(path.join(SOP_DIR, "blocks.csv"));
  const blocks: Block[] = [];
  for (let i = 1; i < rows.length; i++) {
    const [cropLabel, block, sowDate, , , sizeStr] = rows[i];
    if (!block || !sizeStr) continue;
    const size = num(sizeStr);
    if (size <= 0) continue;
    const date = parseDate(sowDate);
    if (!date) continue;
    blocks.push({ cropCode: cropLabel || "", block, sowingDate: date, sizeHa: size });
  }
  let lastCrop = "";
  for (const b of blocks) {
    if (b.cropCode) lastCrop = b.cropCode;
    else b.cropCode = lastCrop;
  }
  return blocks;
}

// ─── 2. Parse key inputs ───
interface CropKeyInput {
  cropName: string;
  yieldTonnes: number;
  nurseryDays: number;
  outgrowingDays: number;
  rejectRate: number;
  weeklyPcts: number[];
}

function parseKeyInputs(): CropKeyInput[] {
  const rows = parseCSV(path.join(SOP_DIR, "key inputs.csv"));
  const crops: CropKeyInput[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const colB = (row[1] || "").trim();
    if (!colB || colB === "") continue;
    if (["Profile", "Yield", "Nursery", "Outgrowing", "Reject"].some(k => colB.includes(k))) continue;

    const cropName = colB;
    const chunk = rows.slice(i + 1, i + 6);
    let yieldTonnes = 0, nurseryDays = 0, outgrowingDays = 0, rejectRate = 0;
    const weeklyPcts: number[] = [];

    for (const r of chunk) {
      const label = (r[2] || "").trim().toLowerCase();
      const val = (r[4] || "").trim();
      if (label.includes("yield")) {
        const unit = (r[5] || "").trim().toLowerCase();
        const n = num(val);
        yieldTonnes = unit.includes("kg") ? n / 1000 : n;
      } else if (label.includes("nursery")) {
        nurseryDays = num(val);
      } else if (label.includes("outgrowing")) {
        outgrowingDays = num(val);
      } else if (label.includes("reject")) {
        rejectRate = num(val);
      } else if (label.includes("profile")) {
        for (let w = 72; w < r.length; w++) {
          const pctStr = (r[w] || "").trim();
          if (!pctStr || pctStr.includes("NAME")) { weeklyPcts.push(0); continue; }
          weeklyPcts.push(num(pctStr.replace("%", "")));
        }
      }
    }
    while (weeklyPcts.length > 0 && weeklyPcts[weeklyPcts.length - 1] === 0) weeklyPcts.pop();
    crops.push({ cropName, yieldTonnes, nurseryDays, outgrowingDays, rejectRate, weeklyPcts });
  }
  return crops;
}

// ─── 3. Parse labour SOP (clean format) ───
// Columns: WEEK, PHASE, TASK, CASUALS, COST_PER_DAY, DAYS, COST
interface LabourEntry {
  weekLabel: string;
  weekNum: number;
  phase: string;
  task: string;
  casuals: number;
  costPerDay: number;
  days: number;
  cost: number;
}

function parseWeekNum(label: string): number {
  // "WK -03" → -3, "WK 00" → 0, "WK 01" → 1, "WK 13" → 13
  const m = label.match(/WK\s*(-?\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

function parseLabour(): LabourEntry[] {
  const rows = parseCSV(path.join(SOP_DIR, "labro.csv"));
  const entries: LabourEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const [weekLabel, phase, task, casualsStr, costDayStr, daysStr, costStr] = rows[i];
    if (!weekLabel || !task) continue;
    const cost = num(costStr);
    if (cost <= 0) continue;
    const weekNum = parseWeekNum(weekLabel);
    entries.push({
      weekLabel: weekLabel.trim(),
      weekNum,
      phase: (phase || "").trim(),
      task: task.trim(),
      casuals: num(casualsStr),
      costPerDay: num(costDayStr),
      days: num(daysStr),
      cost,
    });
  }
  return entries;
}

// ─── 4. Parse nutri SOP (clean format) ───
// Columns: WEEK, PHASE, ACTIVITY, PRODUCT, ACTIVE_INGREDIENT, RATE, RATE_HA, PHI, CATEGORY, UNIT_COST
interface NutriEntry {
  weekNum: number;
  product: string;
  activeIngredient: string;
  activity: string;
  unitCost: number;
  category: string;
}

function parseNutri(): NutriEntry[] {
  const rows = parseCSV(path.join(SOP_DIR, "nutri.csv"));
  const entries: NutriEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const [weekLabel, , activity, product, activeIng, , , , category, unitCostStr] = rows[i];
    if (!weekLabel || !product) continue;
    const unitCost = num(unitCostStr);
    if (unitCost <= 0) continue;
    const weekNum = parseWeekNum(weekLabel);
    entries.push({
      weekNum,
      product: product.trim(),
      activeIngredient: (activeIng || "").trim(),
      activity: (activity || "").trim(),
      unitCost,
      category: (category || "Other").trim(),
    });
  }
  return entries;
}

// ─── 5. Aggregate SOPs by week ───
function aggregateLabour(entries: LabourEntry[]): Map<number, { cost: number; tasks: string[] }> {
  const map = new Map<number, { cost: number; tasks: string[] }>();
  for (const e of entries) {
    const existing = map.get(e.weekNum) || { cost: 0, tasks: [] };
    existing.cost += e.cost;
    if (!existing.tasks.includes(e.task)) existing.tasks.push(e.task);
    map.set(e.weekNum, existing);
  }
  return map;
}

function aggregateNutri(entries: NutriEntry[]): Map<number, { cost: number; products: string[] }> {
  const map = new Map<number, { cost: number; products: string[] }>();
  for (const e of entries) {
    const existing = map.get(e.weekNum) || { cost: 0, products: [] };
    existing.cost += e.unitCost;
    if (!existing.products.includes(e.product)) existing.products.push(e.product);
    map.set(e.weekNum, existing);
  }
  return map;
}

function aggregateNutriByCategory(entries: NutriEntry[]): { category: string; cost: number; items: number }[] {
  const map = new Map<string, { cost: number; items: number }>();
  for (const e of entries) {
    const existing = map.get(e.category) || { cost: 0, items: 0 };
    existing.cost += e.unitCost;
    existing.items++;
    map.set(e.category, existing);
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.cost - a.cost);
}

// ─── IB-style formatting ───
const NAVY = "1F2937";
const DARK_GREEN = "065F46";
const AMBER = "92400E";
const LIGHT_GRAY = "F3F4F6";
const WHITE = "FFFFFF";

const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: WHITE }, size: 10, name: "Calibri" };
const sectionFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
const sectionFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri", color: { argb: NAVY } };
const totalFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBEAFE" } };
const totalFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri" };
const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: "Calibri" };
const subtotalFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E5E7EB" } };
const profitFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
const profitFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri", color: { argb: DARK_GREEN } };
const revenueFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri", color: { argb: "047857" } };
const KES_FMT = '#,##0';
const KG_FMT = '#,##0.0';
const PCT_FMT = '0.0%';
const HA_FMT = '0.0000';

function styleHeaders(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "D1D5DB" } } };
  });
  row.height = 28;
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

function autoWidth(ws: ExcelJS.Worksheet, min = 10, max = 22) {
  ws.columns.forEach((col) => {
    let maxLen = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, max);
  });
}

// ─── MAIN ───
async function main() {
  console.log("Parsing Karakuta SOP files...\n");

  const blocks = parseBlocks();
  const keyInputs = parseKeyInputs();
  const labourEntries = parseLabour();
  const nutriEntries = parseNutri();

  console.log(`Blocks: ${blocks.length}`);
  console.log(`Crops (key inputs): ${keyInputs.length}`);
  console.log(`Labour entries: ${labourEntries.length}`);
  console.log(`Nutri entries: ${nutriEntries.length}`);

  const basilKI = keyInputs.find(k => k.cropName === "Basil");
  if (!basilKI) throw new Error("Basil key input not found");

  console.log(`\nBasil: yield=${basilKI.yieldTonnes}t/ha, nursery=${basilKI.nurseryDays}d, outgrowing=${basilKI.outgrowingDays}d, reject=${basilKI.rejectRate}%`);
  console.log(`Harvest distribution: ${basilKI.weeklyPcts.map(p => p + "%").join(", ")}`);
  console.log(`Price per kg: ${PRICE_PER_KG} KES`);

  const labourByWeek = aggregateLabour(labourEntries);
  const nutriByWeek = aggregateNutri(nutriEntries);
  const nutriByCategory = aggregateNutriByCategory(nutriEntries);

  const totalLabourPerHa = Array.from(labourByWeek.values()).reduce((s, v) => s + v.cost, 0);
  const totalNutriPerHa = Array.from(nutriByWeek.values()).reduce((s, v) => s + v.cost, 0);
  console.log(`\nLabour cost/ha: ${totalLabourPerHa.toLocaleString()} KES`);
  console.log(`Inputs cost/ha: ${totalNutriPerHa.toLocaleString()} KES`);
  console.log(`Total cost/ha: ${(totalLabourPerHa + totalNutriPerHa).toLocaleString()} KES`);

  // ─── Build weekly budget per block ───
  interface BudgetRow {
    block: string;
    phase: string;
    crop: string;
    areaHa: number;
    sowingDate: Date;
    sopWeek: number;
    calDate: Date;
    calMonth: string;
    labourCostHa: number;
    labourCost: number;
    labourTasks: string;
    nutriCostHa: number;
    nutriCost: number;
    totalCost: number;
    harvestWk: number;
    distPct: number;
    grossKg: number;
    rejectKg: number;
    netKg: number;
  }

  const nurseryWks = Math.ceil(basilKI.nurseryDays / 7);
  const outgrowingWks = Math.ceil(basilKI.outgrowingDays / 7);
  const harvestWks = basilKI.weeklyPcts.length;
  const minSopWk = -nurseryWks + 1;
  const maxSopWk = outgrowingWks + harvestWks + 1;

  const budgetRows: BudgetRow[] = [];

  for (const blk of blocks) {
    for (let sopWk = minSopWk; sopWk <= maxSopWk; sopWk++) {
      const calDate = new Date(blk.sowingDate);
      calDate.setDate(calDate.getDate() + (sopWk - minSopWk) * 7);

      const lab = labourByWeek.get(sopWk);
      const nut = nutriByWeek.get(sopWk);
      const labourCostHa = lab?.cost || 0;
      const nutriCostHa = nut?.cost || 0;
      const labourCost = Math.round(labourCostHa * blk.sizeHa);
      const nutriCost = Math.round(nutriCostHa * blk.sizeHa);

      const harvestStartSop = outgrowingWks + 1;
      const harvestWkNum = sopWk - harvestStartSop;
      let distPct = 0, grossKg = 0, rejectKg = 0, netKg = 0;
      if (harvestWkNum >= 0 && harvestWkNum < basilKI.weeklyPcts.length) {
        distPct = basilKI.weeklyPcts[harvestWkNum];
        grossKg = basilKI.yieldTonnes * 1000 * blk.sizeHa * distPct / 100;
        rejectKg = grossKg * basilKI.rejectRate / 100;
        netKg = grossKg - rejectKg;
      }

      budgetRows.push({
        block: blk.block,
        phase: `BAS-${blk.block}`,
        crop: blk.cropCode,
        areaHa: blk.sizeHa,
        sowingDate: blk.sowingDate,
        sopWeek: sopWk,
        calDate,
        calMonth: monthKey(calDate),
        labourCostHa,
        labourCost,
        labourTasks: lab?.tasks.join(" | ") || "",
        nutriCostHa,
        nutriCost,
        totalCost: labourCost + nutriCost,
        harvestWk: harvestWkNum >= 0 ? harvestWkNum + 1 : 0,
        distPct,
        grossKg: Math.round(grossKg * 10) / 10,
        rejectKg: Math.round(rejectKg * 10) / 10,
        netKg: Math.round(netKg * 10) / 10,
      });
    }
  }

  console.log(`\nBudget rows: ${budgetRows.length}`);

  // ─── Aggregate to monthly ───
  interface MonthlyData {
    labour: number;
    fertilizer: number;
    cropProtection: number;
    foliarFeed: number;
    plantingMaterial: number;
    otherInputs: number;
    totalInputs: number;
    totalCost: number;
    grossKg: number;
    rejectKg: number;
    netKg: number;
    revenue: number;
  }

  // We also need nutri entries aggregated by category per SOP week
  // to split input costs on the budget rows
  const nutriWeekByCat = new Map<number, Map<string, number>>();
  for (const e of nutriEntries) {
    if (!nutriWeekByCat.has(e.weekNum)) nutriWeekByCat.set(e.weekNum, new Map());
    const catMap = nutriWeekByCat.get(e.weekNum)!;
    catMap.set(e.category, (catMap.get(e.category) || 0) + e.unitCost);
  }

  // Get total nutri cost per SOP week for proportional split
  const nutriWeekTotal = new Map<number, number>();
  for (const [wk, catMap] of nutriWeekByCat) {
    nutriWeekTotal.set(wk, Array.from(catMap.values()).reduce((s, v) => s + v, 0));
  }

  // Get all months sorted chronologically
  const monthSet = new Set<string>();
  for (const r of budgetRows) {
    if (r.totalCost > 0 || r.netKg > 0) monthSet.add(r.calMonth);
  }
  // Sort months chronologically, filter to Jan 2026 – Jun 2026
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthIndex = (key: string) => {
    const [m, y] = key.split(" ");
    return parseInt(y) * 12 + MONTH_NAMES.indexOf(m);
  };
  const START_MONTH = monthIndex("Jan 2026");
  const END_MONTH = monthIndex("Jun 2026");

  const allMonths = Array.from(monthSet)
    .filter(m => { const idx = monthIndex(m); return idx >= START_MONTH && idx <= END_MONTH; })
    .sort((a, b) => monthIndex(a) - monthIndex(b));

  console.log(`Months: ${allMonths.join(", ")}`);

  // Aggregate budget rows monthly
  const monthly = new Map<string, MonthlyData>();
  for (const m of allMonths) {
    monthly.set(m, {
      labour: 0, fertilizer: 0, cropProtection: 0, foliarFeed: 0,
      plantingMaterial: 0, otherInputs: 0, totalInputs: 0, totalCost: 0,
      grossKg: 0, rejectKg: 0, netKg: 0, revenue: 0,
    });
  }

  for (const r of budgetRows) {
    const md = monthly.get(r.calMonth);
    if (!md) continue;

    md.labour += r.labourCost;
    md.grossKg += r.grossKg;
    md.rejectKg += r.rejectKg;
    md.netKg += r.netKg;

    // Split nutri cost proportionally by category
    if (r.nutriCost > 0) {
      const catMap = nutriWeekByCat.get(r.sopWeek);
      const weekTotal = nutriWeekTotal.get(r.sopWeek) || 1;
      if (catMap) {
        for (const [cat, catCost] of catMap) {
          const proportion = catCost / weekTotal;
          const allocatedCost = r.nutriCost * proportion;
          switch (cat) {
            case "Fertilizer": md.fertilizer += allocatedCost; break;
            case "Crop Protection": md.cropProtection += allocatedCost; break;
            case "Foliar Feed": md.foliarFeed += allocatedCost; break;
            case "Planting Material": md.plantingMaterial += allocatedCost; break;
            default: md.otherInputs += allocatedCost; break;
          }
        }
      }
    }
  }

  // Compute totals
  for (const md of monthly.values()) {
    md.fertilizer = Math.round(md.fertilizer);
    md.cropProtection = Math.round(md.cropProtection);
    md.foliarFeed = Math.round(md.foliarFeed);
    md.plantingMaterial = Math.round(md.plantingMaterial);
    md.otherInputs = Math.round(md.otherInputs);
    md.totalInputs = md.fertilizer + md.cropProtection + md.foliarFeed + md.plantingMaterial + md.otherInputs;
    md.totalCost = md.labour + md.totalInputs;
    md.revenue = Math.round(md.netKg * PRICE_PER_KG);
  }

  // ─── CREATE WORKBOOK ───
  const wb = new ExcelJS.Workbook();
  wb.creator = "Karakuta Budget Model";

  // ═══════════════════════════════════════
  // SHEET 1: INCOME STATEMENT (transposed — line items as rows, months as columns)
  // ═══════════════════════════════════════
  const wsIS = wb.addWorksheet("Income Statement", { properties: { tabColor: { argb: NAVY } } });

  // Headers: "Line Item" + months + "TOTAL"
  const isHeaders = ["", ...allMonths, "TOTAL"];
  wsIS.addRow(isHeaders);
  styleHeaders(wsIS);
  // Freeze first column + header row
  wsIS.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  wsIS.getColumn(1).width = 28;
  for (let i = 2; i <= isHeaders.length; i++) wsIS.getColumn(i).width = 14;

  // Helper to add a data row
  type RowStyle = "section" | "body" | "subtotal" | "total" | "profit" | "revenue" | "blank";
  function addISRow(label: string, values: (number | null)[], style: RowStyle, numFmt: string = KES_FMT) {
    const total = values.reduce<number>((s, v) => s + (v || 0), 0);
    const row = wsIS.addRow([label, ...values, Math.round(total)]);

    switch (style) {
      case "section":
        row.eachCell((c) => { c.fill = sectionFill; c.font = sectionFont; });
        break;
      case "subtotal":
        row.eachCell((c) => { c.fill = subtotalFill; c.font = totalFont; });
        break;
      case "total":
        row.eachCell((c) => { c.fill = totalFill; c.font = totalFont; });
        break;
      case "profit":
        row.eachCell((c) => { c.fill = profitFill; c.font = profitFont; });
        break;
      case "revenue":
        row.eachCell((c) => { c.font = revenueFont; });
        break;
      case "blank":
        return row;
      default:
        row.font = bodyFont;
    }

    // Apply number format to data columns (skip label column)
    for (let c = 2; c <= row.cellCount; c++) {
      row.getCell(c).numFmt = numFmt;
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(1).alignment = { horizontal: "left", indent: style === "body" ? 2 : 0 };

    // Bottom border on subtotals/totals
    if (["subtotal", "total", "profit"].includes(style)) {
      row.eachCell((c) => {
        c.border = { bottom: { style: "thin", color: { argb: "9CA3AF" } } };
      });
    }

    return row;
  }

  // ── REVENUE SECTION ──
  addISRow("REVENUE", allMonths.map(() => null), "section");

  const netKgs = allMonths.map(m => Math.round(monthly.get(m)!.netKg * 10) / 10);
  addISRow("  Net Saleable (kg)", netKgs, "body", KG_FMT);
  addISRow(`  Price per kg (KES ${PRICE_PER_KG})`, allMonths.map(() => PRICE_PER_KG), "body", KES_FMT);
  const revenues = allMonths.map(m => monthly.get(m)!.revenue);
  addISRow("Total Revenue", revenues, "revenue", KES_FMT);

  addISRow("", allMonths.map(() => null), "blank");

  // ── COST OF PRODUCTION ──
  addISRow("COST OF PRODUCTION", allMonths.map(() => null), "section");

  // Labour
  const labours = allMonths.map(m => monthly.get(m)!.labour);
  addISRow("  Labour", labours, "body");

  // Input line items
  addISRow("  Inputs & Materials", allMonths.map(() => null), "section");
  const fertilizers = allMonths.map(m => monthly.get(m)!.fertilizer);
  addISRow("    Fertilizer", fertilizers, "body");
  const cropProt = allMonths.map(m => monthly.get(m)!.cropProtection);
  addISRow("    Crop Protection", cropProt, "body");
  const foliar = allMonths.map(m => monthly.get(m)!.foliarFeed);
  addISRow("    Foliar Feed", foliar, "body");
  const planting = allMonths.map(m => monthly.get(m)!.plantingMaterial);
  addISRow("    Planting Material", planting, "body");
  const otherInp = allMonths.map(m => monthly.get(m)!.otherInputs);
  if (otherInp.some(v => v > 0)) {
    addISRow("    Other Inputs", otherInp, "body");
  }

  // Subtotal inputs
  const totalInputs = allMonths.map(m => monthly.get(m)!.totalInputs);
  addISRow("  Total Inputs", totalInputs, "subtotal");

  // Total COGS
  const totalCosts = allMonths.map(m => monthly.get(m)!.totalCost);
  addISRow("Total Cost of Production", totalCosts, "total");

  addISRow("", allMonths.map(() => null), "blank");

  // ── GROSS PROFIT ──
  const grossProfits = allMonths.map((_, i) => revenues[i] - totalCosts[i]);
  addISRow("GROSS PROFIT", grossProfits, "profit");

  // Gross margin
  const grossMargins = allMonths.map((_, i) => revenues[i] > 0 ? grossProfits[i] / revenues[i] : 0);
  const marginTotal = revenues.reduce((s, v) => s + v, 0);
  const marginRow = wsIS.addRow([
    "Gross Margin %",
    ...grossMargins,
    marginTotal > 0 ? grossProfits.reduce((s, v) => s + v, 0) / marginTotal : 0,
  ]);
  marginRow.font = profitFont;
  for (let c = 2; c <= marginRow.cellCount; c++) {
    marginRow.getCell(c).numFmt = PCT_FMT;
    marginRow.getCell(c).alignment = { horizontal: "right" };
  }

  addISRow("", allMonths.map(() => null), "blank");

  // ── PRODUCTION SUMMARY ──
  addISRow("PRODUCTION SUMMARY", allMonths.map(() => null), "section");
  const grossKgs = allMonths.map(m => Math.round(monthly.get(m)!.grossKg * 10) / 10);
  addISRow("  Gross Production (kg)", grossKgs, "body", KG_FMT);
  const rejectKgs = allMonths.map(m => Math.round(monthly.get(m)!.rejectKg * 10) / 10);
  addISRow("  Reject (kg)", rejectKgs, "body", KG_FMT);
  addISRow("  Net Saleable (kg)", netKgs, "subtotal", KG_FMT);

  // Cost per kg
  const costPerKgs = allMonths.map((_, i) => netKgs[i] > 0 ? Math.round(totalCosts[i] / netKgs[i]) : 0);
  addISRow("  Cost per kg (KES)", costPerKgs, "body", KES_FMT);

  // Labour % / Inputs %
  const labourPcts = allMonths.map((_, i) => totalCosts[i] > 0 ? labours[i] / totalCosts[i] : 0);
  const labPctRow = wsIS.addRow([
    "  Labour % of Cost",
    ...labourPcts,
    totalCosts.reduce((s, v) => s + v, 0) > 0 ? labours.reduce((s, v) => s + v, 0) / totalCosts.reduce((s, v) => s + v, 0) : 0,
  ]);
  labPctRow.font = bodyFont;
  for (let c = 2; c <= labPctRow.cellCount; c++) {
    labPctRow.getCell(c).numFmt = PCT_FMT;
    labPctRow.getCell(c).alignment = { horizontal: "right" };
  }
  labPctRow.getCell(1).alignment = { horizontal: "left", indent: 2 };

  const inputPcts = allMonths.map((_, i) => totalCosts[i] > 0 ? totalInputs[i] / totalCosts[i] : 0);
  const inpPctRow = wsIS.addRow([
    "  Inputs % of Cost",
    ...inputPcts,
    totalCosts.reduce((s, v) => s + v, 0) > 0 ? totalInputs.reduce((s, v) => s + v, 0) / totalCosts.reduce((s, v) => s + v, 0) : 0,
  ]);
  inpPctRow.font = bodyFont;
  for (let c = 2; c <= inpPctRow.cellCount; c++) {
    inpPctRow.getCell(c).numFmt = PCT_FMT;
    inpPctRow.getCell(c).alignment = { horizontal: "right" };
  }
  inpPctRow.getCell(1).alignment = { horizontal: "left", indent: 2 };

  // ═══════════════════════════════════════
  // SHEET 2: MONTHLY PRODUCTION BY BLOCK
  // ═══════════════════════════════════════
  const wsProd = wb.addWorksheet("Production by Block", { properties: { tabColor: { argb: DARK_GREEN } } });

  const prodHeaders = ["Block", "Area (Ha)", ...allMonths, "Total (kg)"];
  wsProd.addRow(prodHeaders);
  styleHeaders(wsProd);

  const blockNames = [...new Set(blocks.map(b => b.block))].sort();
  const monthProdTotals = new Array(allMonths.length).fill(0);

  for (const blkName of blockNames) {
    const blkRows = budgetRows.filter(r => r.block === blkName && r.netKg > 0);
    if (blkRows.length === 0) continue;
    const areaHa = blkRows[0].areaHa;

    const monthMap = new Map<string, number>();
    let rowTotal = 0;
    for (const r of blkRows) {
      monthMap.set(r.calMonth, (monthMap.get(r.calMonth) || 0) + r.netKg);
      rowTotal += r.netKg;
    }

    const vals = allMonths.map((m, i) => {
      const v = Math.round((monthMap.get(m) || 0) * 10) / 10;
      monthProdTotals[i] += v;
      return v || null;
    });

    const row = wsProd.addRow([blkName, areaHa, ...vals, Math.round(rowTotal * 10) / 10]);
    row.font = bodyFont;
    row.getCell(2).numFmt = HA_FMT;
    for (let c = 3; c <= row.cellCount; c++) row.getCell(c).numFmt = KG_FMT;
  }

  const prodTotRow = wsProd.addRow(["TOTAL", blocks.reduce((s, b) => s + b.sizeHa, 0), ...monthProdTotals, monthProdTotals.reduce((s, v) => s + v, 0)]);
  prodTotRow.eachCell(cell => { cell.fill = totalFill; cell.font = totalFont; });
  prodTotRow.getCell(2).numFmt = HA_FMT;
  for (let c = 3; c <= prodTotRow.cellCount; c++) prodTotRow.getCell(c).numFmt = KG_FMT;
  autoWidth(wsProd, 8, 16);

  // ═══════════════════════════════════════
  // SHEET 3: MONTHLY COST BY BLOCK
  // ═══════════════════════════════════════
  const wsCost = wb.addWorksheet("Cost by Block", { properties: { tabColor: { argb: AMBER } } });

  wsCost.addRow(["Block", "Area (Ha)", ...allMonths, "Total (KES)"]);
  styleHeaders(wsCost);

  const monthCostTotals = new Array(allMonths.length).fill(0);

  for (const blkName of blockNames) {
    const blkRows = budgetRows.filter(r => r.block === blkName && r.totalCost > 0);
    if (blkRows.length === 0) continue;

    const monthMap = new Map<string, number>();
    let rowTotal = 0;
    for (const r of blkRows) {
      monthMap.set(r.calMonth, (monthMap.get(r.calMonth) || 0) + r.totalCost);
      rowTotal += r.totalCost;
    }

    const vals = allMonths.map((m, i) => {
      const v = Math.round(monthMap.get(m) || 0);
      monthCostTotals[i] += v;
      return v || null;
    });

    const row = wsCost.addRow([blkName, blkRows[0].areaHa, ...vals, Math.round(rowTotal)]);
    row.font = bodyFont;
    row.getCell(2).numFmt = HA_FMT;
    for (let c = 3; c <= row.cellCount; c++) row.getCell(c).numFmt = KES_FMT;
  }

  const costTotRow = wsCost.addRow(["TOTAL", blocks.reduce((s, b) => s + b.sizeHa, 0), ...monthCostTotals, monthCostTotals.reduce((s, v) => s + v, 0)]);
  costTotRow.eachCell(cell => { cell.fill = totalFill; cell.font = totalFont; });
  costTotRow.getCell(2).numFmt = HA_FMT;
  for (let c = 3; c <= costTotRow.cellCount; c++) costTotRow.getCell(c).numFmt = KES_FMT;
  autoWidth(wsCost, 8, 16);

  // ═══════════════════════════════════════
  // SHEET 4: BUDGET DERIVATIVES (detailed weekly data)
  // ═══════════════════════════════════════
  const wsDeriv = wb.addWorksheet("Budget Derivatives", { properties: { tabColor: { argb: "7C3AED" } } });

  const derivHeaders = [
    "Block", "Area (Ha)", "SOP Week", "Calendar Date", "Month",
    "Labour Tasks", "Labour/Ha", "Labour Cost",
    "Inputs/Ha", "Inputs Cost", "Total Cost",
    "Harvest Wk", "Dist %", "Gross (kg)", "Reject (kg)", "Net (kg)",
    "Revenue (KES)", "Profit (KES)",
  ];
  wsDeriv.addRow(derivHeaders);
  styleHeaders(wsDeriv);

  for (const r of budgetRows) {
    if (r.totalCost === 0 && r.netKg === 0) continue;
    const rev = Math.round(r.netKg * PRICE_PER_KG);
    const row = wsDeriv.addRow([
      r.block, r.areaHa, r.sopWeek, r.calDate, r.calMonth,
      r.labourTasks, r.labourCostHa, r.labourCost,
      r.nutriCostHa, r.nutriCost, r.totalCost,
      r.harvestWk || null, r.distPct ? r.distPct / 100 : null,
      r.grossKg || null, r.rejectKg || null, r.netKg || null,
      rev || null, rev ? rev - r.totalCost : null,
    ]);
    row.font = bodyFont;
    row.getCell(2).numFmt = HA_FMT;
    row.getCell(4).numFmt = "DD-MMM-YY";
    [7, 8, 9, 10, 11].forEach(c => row.getCell(c).numFmt = KES_FMT);
    row.getCell(13).numFmt = PCT_FMT;
    [14, 15, 16].forEach(c => row.getCell(c).numFmt = KG_FMT);
    [17, 18].forEach(c => row.getCell(c).numFmt = KES_FMT);
  }
  autoWidth(wsDeriv, 10, 22);

  // ═══════════════════════════════════════
  // SHEET 5: SOP REFERENCE
  // ═══════════════════════════════════════
  const wsRef = wb.addWorksheet("SOP Reference", { properties: { tabColor: { argb: "059669" } } });

  wsRef.addRow(["BASIL LABOUR SOP — Cost per Hectare"]);
  wsRef.getRow(1).font = { bold: true, size: 12, name: "Calibri" };
  wsRef.addRow(["SOP Week", "Tasks", "Cost/Ha (KES)"]);
  wsRef.getRow(2).font = headerFont;
  wsRef.getRow(2).eachCell(c => c.fill = headerFill);

  const sortedLabWeeks = Array.from(labourByWeek.entries()).sort((a, b) => a[0] - b[0]);
  for (const [wk, v] of sortedLabWeeks) {
    const row = wsRef.addRow([wk <= 0 ? `Nursery/Prep ${wk}` : `Week ${wk}`, v.tasks.join(" | "), v.cost]);
    row.font = bodyFont;
    row.getCell(3).numFmt = KES_FMT;
  }
  const labTotRow = wsRef.addRow(["TOTAL", "", totalLabourPerHa]);
  labTotRow.eachCell(c => { c.fill = totalFill; c.font = totalFont; });
  labTotRow.getCell(3).numFmt = KES_FMT;

  wsRef.addRow([]);
  wsRef.addRow(["INPUT COST BREAKDOWN"]);
  wsRef.getRow(wsRef.rowCount).font = { bold: true, size: 12, name: "Calibri" };
  wsRef.addRow(["Category", "Items", "Total Cost/Ha (KES)"]);
  const catHdrRow = wsRef.getRow(wsRef.rowCount);
  catHdrRow.font = headerFont;
  catHdrRow.eachCell(c => c.fill = headerFill);

  for (const cat of nutriByCategory) {
    const row = wsRef.addRow([cat.category, cat.items, cat.cost]);
    row.font = bodyFont;
    row.getCell(3).numFmt = KES_FMT;
  }
  const nutTotRow = wsRef.addRow(["TOTAL", nutriEntries.length, totalNutriPerHa]);
  nutTotRow.eachCell(c => { c.fill = totalFill; c.font = totalFont; });
  nutTotRow.getCell(3).numFmt = KES_FMT;

  autoWidth(wsRef, 12, 40);

  // ═══════════════════════════════════════
  // SHEET 6: KEY INPUTS
  // ═══════════════════════════════════════
  const wsKI = wb.addWorksheet("Key Inputs", { properties: { tabColor: { argb: "DC2626" } } });
  wsKI.addRow(["Crop", "Yield (t/ha)", "Nursery (days)", "Outgrowing (days)", "Reject %", "Harvest Weeks", "Distribution"]);
  styleHeaders(wsKI);

  for (const ki of keyInputs) {
    const distStr = ki.weeklyPcts.map((p, i) => `W${i + 1}:${p}%`).join("  ");
    const row = wsKI.addRow([
      ki.cropName, ki.yieldTonnes, ki.nurseryDays, ki.outgrowingDays,
      ki.rejectRate / 100, ki.weeklyPcts.length, distStr,
    ]);
    row.font = bodyFont;
    row.getCell(5).numFmt = PCT_FMT;
  }
  autoWidth(wsKI, 10, 60);

  // ═══════════════════════════════════════
  // SHEET 7: BLOCKS
  // ═══════════════════════════════════════
  const wsBlk = wb.addWorksheet("Blocks", { properties: { tabColor: { argb: "EA580C" } } });
  wsBlk.addRow(["Block", "Crop", "Sowing Date", "Area (Ha)", "Yield (t/ha)", "Reject %",
    "Gross Yield (kg)", "Net Yield (kg)"]);
  styleHeaders(wsBlk);

  for (const b of blocks) {
    const gross = Math.round(basilKI.yieldTonnes * 1000 * b.sizeHa);
    const net = Math.round(gross * (1 - basilKI.rejectRate / 100));
    const row = wsBlk.addRow([
      b.block, b.cropCode, b.sowingDate, b.sizeHa,
      basilKI.yieldTonnes, basilKI.rejectRate / 100, gross, net,
    ]);
    row.font = bodyFont;
    row.getCell(3).numFmt = "DD-MMM-YY";
    row.getCell(4).numFmt = HA_FMT;
    row.getCell(6).numFmt = PCT_FMT;
    [7, 8].forEach(c => row.getCell(c).numFmt = KG_FMT);
  }

  const blkTot = wsBlk.addRow([
    "TOTAL", "", null, blocks.reduce((s, b) => s + b.sizeHa, 0), null, null,
    Math.round(basilKI.yieldTonnes * 1000 * blocks.reduce((s, b) => s + b.sizeHa, 0)),
    Math.round(basilKI.yieldTonnes * 1000 * blocks.reduce((s, b) => s + b.sizeHa, 0) * (1 - basilKI.rejectRate / 100)),
  ]);
  blkTot.eachCell(c => { c.fill = totalFill; c.font = totalFont; });
  blkTot.getCell(4).numFmt = HA_FMT;
  [7, 8].forEach(c => blkTot.getCell(c).numFmt = KG_FMT);

  autoWidth(wsBlk, 10, 20);

  // ═══════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════
  await wb.xlsx.writeFile(OUTPUT);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`SAVED: ${OUTPUT}`);
  console.log(`${"═".repeat(50)}\n`);
  console.log("SHEETS:");
  console.log("  1. Income Statement — Monthly P&L (line items as rows, months as columns)");
  console.log("     Revenue at 350 KES/kg, Labour + Inputs breakdown, Gross Profit & Margin");
  console.log("  2. Production by Block — Net kg per month per block");
  console.log("  3. Cost by Block — Total cost per month per block");
  console.log("  4. Budget Derivatives — Full weekly detail: every block × every SOP week");
  console.log("  5. SOP Reference — Labour tasks + input categories per ha");
  console.log("  6. Key Inputs — All 18 crops: yield, reject, distribution");
  console.log("  7. Blocks — All blocks with sizes and expected yields");
}

main().catch(console.error);
