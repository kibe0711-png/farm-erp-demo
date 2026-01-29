import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsPDF } from "jspdf";

// GET /api/reports/daily-pdf?date=2026-01-29
// Auth: x-api-key header
// Returns: application/pdf binary
export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.REPORT_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    // Target date — defaults to today in EAT (UTC+2)
    const now = new Date();
    const eat = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const targetDate = dateParam ? new Date(dateParam) : eat;
    const dateStr = targetDate.toISOString().split("T")[0];

    // Compute Monday and day-of-week
    const dayJs = targetDate.getDay();
    const dayOffset = dayJs === 0 ? 6 : dayJs - 1;
    const monday = new Date(targetDate);
    monday.setDate(monday.getDate() - dayOffset);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split("T")[0];
    const todayDayOfWeek = dayOffset;
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // ISO week number
    const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
    const dn = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dn);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    // Fetch data
    const [phases, laborSops, nutriSops, farms] = await Promise.all([
      prisma.farmPhase.findMany(),
      prisma.laborSop.findMany(),
      prisma.nutriSop.findMany(),
      prisma.farm.findMany(),
    ]);

    const allPhaseIds = phases.map((p) => p.id);
    const weekDate = new Date(mondayStr);

    const [allLaborSchedules, allNutriSchedules, overrides] = await Promise.all([
      allPhaseIds.length > 0
        ? prisma.laborSchedule.findMany({ where: { farmPhaseId: { in: allPhaseIds }, weekStartDate: weekDate } })
        : [],
      allPhaseIds.length > 0
        ? prisma.nutriSchedule.findMany({ where: { farmPhaseId: { in: allPhaseIds }, weekStartDate: weekDate } })
        : [],
      allPhaseIds.length > 0
        ? prisma.phaseActivityOverride.findMany({ where: { farmPhaseId: { in: allPhaseIds }, weekStart: weekDate } })
        : [],
    ]);

    // Day count maps
    const laborDayCount = new Map<string, number>();
    allLaborSchedules.forEach((ls) => {
      const key = `${ls.farmPhaseId}-${ls.laborSopId}`;
      laborDayCount.set(key, (laborDayCount.get(key) || 0) + 1);
    });
    const nutriDayCount = new Map<string, number>();
    allNutriSchedules.forEach((ns) => {
      const key = `${ns.farmPhaseId}-${ns.nutriSopId}`;
      nutriDayCount.set(key, (nutriDayCount.get(key) || 0) + 1);
    });

    // Today sets
    const todayLaborSet = new Set(
      allLaborSchedules.filter((ls) => ls.dayOfWeek === todayDayOfWeek).map((ls) => `${ls.farmPhaseId}-${ls.laborSopId}`)
    );
    const todayNutriSet = new Set(
      allNutriSchedules.filter((ns) => ns.dayOfWeek === todayDayOfWeek).map((ns) => `${ns.farmPhaseId}-${ns.nutriSopId}`)
    );

    // Override + farm rate maps
    const overrideMap = new Map<string, string>();
    overrides.forEach((o) => overrideMap.set(`${o.farmPhaseId}-${o.sopId}-${o.sopType}`, o.action));
    const farmRateMap = new Map<string, number>();
    farms.forEach((f) => { if (f.laborRatePerDay != null) farmRateMap.set(f.name, Number(f.laborRatePerDay)); });

    // Group phases
    const farmGroups = new Map<string, typeof phases>();
    phases.forEach((p) => {
      if (!farmGroups.has(p.farm)) farmGroups.set(p.farm, []);
      farmGroups.get(p.farm)!.push(p);
    });

    // Build summaries
    interface LaborTask { phase: string; task: string; mandays: number; costPerDay: number; totalCost: number }
    interface NutriTask { phase: string; product: string; quantity: number; totalCost: number }
    interface FarmSummary {
      farm: string; laborTasks: LaborTask[]; nutriTasks: NutriTask[];
      totalLaborMandays: number; totalLaborCost: number; totalNutriCost: number;
    }

    const farmSummaries: FarmSummary[] = [];

    for (const [farmName, farmPhases] of farmGroups) {
      const laborTasks: LaborTask[] = [];
      const nutriTasks: NutriTask[] = [];
      const farmRate = farmRateMap.get(farmName);

      for (const phase of farmPhases) {
        const diffMs = monday.getTime() - new Date(phase.sowingDate).getTime();
        const weeksSinceSowing = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        if (weeksSinceSowing < 0) continue;
        const areaHa = Number(phase.areaHa) || 0;

        // Labor
        const matchLabor = laborSops.filter((s) => s.cropCode === phase.cropCode && s.week === weeksSinceSowing);
        const processLabor = (sop: (typeof laborSops)[number]) => {
          const key = `${phase.id}-${sop.id}`;
          if (overrideMap.get(`${key}-labor`) === "remove") return;
          if (!todayLaborSet.has(key)) return;
          const costPerDay = farmRate && farmRate > 0 ? farmRate : Number(sop.costPerCasualDay) || 0;
          const totalMandays = sop.noOfCasuals * sop.noOfDays * areaHa;
          const days = laborDayCount.get(key) || 1;
          laborTasks.push({ phase: phase.phaseId, task: sop.task, mandays: totalMandays / days, costPerDay, totalCost: (totalMandays / days) * costPerDay });
        };
        matchLabor.forEach(processLabor);
        overrides.filter((o) => o.farmPhaseId === phase.id && o.sopType === "labor" && o.action === "add").forEach((o) => {
          const sop = laborSops.find((s) => s.id === o.sopId);
          if (sop && !matchLabor.some((s) => s.id === sop.id)) processLabor(sop);
        });

        // Nutri
        const matchNutri = nutriSops.filter((s) => s.cropCode === phase.cropCode && s.week === weeksSinceSowing);
        const processNutri = (sop: (typeof nutriSops)[number]) => {
          const key = `${phase.id}-${sop.id}`;
          if (overrideMap.get(`${key}-nutri`) === "remove") return;
          if (!todayNutriSet.has(key)) return;
          const days = nutriDayCount.get(key) || 1;
          const totalQty = (Number(sop.rateHa) || 0) * areaHa;
          const costPerHa = Number(sop.cost) || 0;
          nutriTasks.push({ phase: phase.phaseId, product: sop.products, quantity: totalQty / days, totalCost: (costPerHa * areaHa) / days });
        };
        matchNutri.forEach(processNutri);
        overrides.filter((o) => o.farmPhaseId === phase.id && o.sopType === "nutri" && o.action === "add").forEach((o) => {
          const sop = nutriSops.find((s) => s.id === o.sopId);
          if (sop && !matchNutri.some((s) => s.id === sop.id)) processNutri(sop);
        });
      }

      if (laborTasks.length > 0 || nutriTasks.length > 0) {
        farmSummaries.push({
          farm: farmName,
          laborTasks,
          nutriTasks,
          totalLaborMandays: laborTasks.reduce((s, t) => s + t.mandays, 0),
          totalLaborCost: laborTasks.reduce((s, t) => s + t.totalCost, 0),
          totalNutriCost: nutriTasks.reduce((s, t) => s + t.totalCost, 0),
        });
      }
    }

    // ── Generate PDF ──────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 12) {
        doc.addPage();
        y = margin;
      }
    };

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 148, 136); // teal
    doc.text("Souk FarmIQ", margin, y);
    y += 7;
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(`Daily Task Summary`, margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`${dayNames[todayDayOfWeek]}, ${dateStr}  |  Week ${weekNumber}`, margin, y);
    y += 10;

    if (farmSummaries.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(107, 114, 128);
      doc.text("No scheduled tasks for today.", margin, y);
    } else {
      for (const farm of farmSummaries) {
        checkPage(20);

        // Farm header
        doc.setFillColor(240, 253, 250);
        doc.rect(margin, y - 4, contentW, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 148, 136);
        doc.text(farm.farm, margin + 2, y);
        y += 8;

        // Labor table
        if (farm.laborTasks.length > 0) {
          checkPage(10 + farm.laborTasks.length * 6);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(31, 41, 55);
          doc.text("Labor Tasks", margin, y);
          y += 5;

          // Table header
          const cols = [margin, margin + 30, margin + 70, margin + 100, margin + 125];
          doc.setFillColor(243, 244, 246);
          doc.rect(margin, y - 3.5, contentW, 5, "F");
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(75, 85, 99);
          doc.text("Phase", cols[0] + 1, y);
          doc.text("Task", cols[1] + 1, y);
          doc.text("Mandays", cols[2] + 1, y);
          doc.text("Cost/Day", cols[3] + 1, y);
          doc.text("Total Cost", cols[4] + 1, y);
          y += 5;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 65, 81);
          for (const t of farm.laborTasks) {
            checkPage(6);
            doc.text(t.phase, cols[0] + 1, y);
            doc.text(t.task.substring(0, 25), cols[1] + 1, y);
            doc.text(t.mandays.toFixed(1), cols[2] + 1, y);
            doc.text(t.costPerDay.toFixed(0), cols[3] + 1, y);
            doc.text(Math.round(t.totalCost).toLocaleString(), cols[4] + 1, y);
            y += 5;
          }

          // Total row
          doc.setFillColor(240, 253, 250);
          doc.rect(margin, y - 3.5, contentW, 5, "F");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(13, 148, 136);
          doc.text("Total", cols[0] + 1, y);
          doc.text(farm.totalLaborMandays.toFixed(1), cols[2] + 1, y);
          doc.text(Math.round(farm.totalLaborCost).toLocaleString() + " RWF", cols[4] + 1, y);
          y += 8;
        }

        // Nutri table
        if (farm.nutriTasks.length > 0) {
          checkPage(10 + farm.nutriTasks.length * 6);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(31, 41, 55);
          doc.text("Nutrition Tasks", margin, y);
          y += 5;

          const cols = [margin, margin + 30, margin + 80, margin + 125];
          doc.setFillColor(243, 244, 246);
          doc.rect(margin, y - 3.5, contentW, 5, "F");
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(75, 85, 99);
          doc.text("Phase", cols[0] + 1, y);
          doc.text("Product", cols[1] + 1, y);
          doc.text("Qty", cols[2] + 1, y);
          doc.text("Total Cost", cols[3] + 1, y);
          y += 5;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 65, 81);
          for (const t of farm.nutriTasks) {
            checkPage(6);
            doc.text(t.phase, cols[0] + 1, y);
            doc.text(t.product.substring(0, 30), cols[1] + 1, y);
            doc.text(t.quantity.toFixed(2), cols[2] + 1, y);
            doc.text(Math.round(t.totalCost).toLocaleString(), cols[3] + 1, y);
            y += 5;
          }

          doc.setFillColor(240, 253, 250);
          doc.rect(margin, y - 3.5, contentW, 5, "F");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(13, 148, 136);
          doc.text("Total", cols[0] + 1, y);
          doc.text(Math.round(farm.totalNutriCost).toLocaleString() + " RWF", cols[3] + 1, y);
          y += 8;
        }

        y += 4;
      }

      // Grand totals
      checkPage(20);
      doc.setDrawColor(13, 148, 136);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text("Grand Totals", margin, y);
      y += 6;

      const grandLabor = farmSummaries.reduce((s, f) => s + f.totalLaborCost, 0);
      const grandNutri = farmSummaries.reduce((s, f) => s + f.totalNutriCost, 0);
      const grandMandays = farmSummaries.reduce((s, f) => s + f.totalLaborMandays, 0);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Labor: ${grandMandays.toFixed(1)} mandays  |  ${Math.round(grandLabor).toLocaleString()} RWF`, margin, y);
      y += 5;
      doc.text(`Nutrition: ${Math.round(grandNutri).toLocaleString()} RWF`, margin, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 148, 136);
      doc.text(`Combined: ${Math.round(grandLabor + grandNutri).toLocaleString()} RWF`, margin, y);
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated ${new Date().toISOString()} by Souk FarmIQ`, margin, pageH - 6);

    // Output PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="FarmIQ-Daily-${dateStr}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate daily PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
