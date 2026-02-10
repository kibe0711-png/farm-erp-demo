"use client";

import { useMemo } from "react";
import jsPDF from "jspdf";

interface AttendanceRecordItem {
  id: number;
  casualWorkerId: number;
  casualWorker: { name: string; nationalId: string | null };
  date: string;
  farmPhaseId: number;
  activity: string;
  rateType: string;
  rate: number;
  units: number;
  adjustment: number;
  amount: number;
}

interface PayrollRow {
  casualWorkerId: number;
  name: string;
  daysWorked: number;
  dailyPay: number;
  perKgPay: number;
  adjustments: number;
  totalPay: number;
}

interface LabourPayrollSummaryProps {
  weekRecords: AttendanceRecordItem[];
  selectedFarm: string;
  selectedWeek: number;
  selectedYear: number;
  weekStr: string;
  getPhaseLabel: (farmPhaseId: number) => string;
}

export default function LabourPayrollSummary({
  weekRecords,
  selectedFarm,
  selectedWeek,
  selectedYear,
  weekStr,
  getPhaseLabel,
}: LabourPayrollSummaryProps) {
  const payrollSummary: PayrollRow[] = useMemo(() => {
    const byCasual = new Map<number, {
      name: string;
      days: Set<string>;
      dailyPay: number;
      perKgPay: number;
      adjustments: number;
    }>();

    weekRecords.forEach((r) => {
      const existing = byCasual.get(r.casualWorkerId) || {
        name: r.casualWorker.name,
        days: new Set<string>(),
        dailyPay: 0,
        perKgPay: 0,
        adjustments: 0,
      };
      existing.days.add(r.date);
      existing.adjustments += r.adjustment;
      if (r.rateType === "daily") {
        existing.dailyPay += r.amount;
      } else {
        existing.perKgPay += r.amount;
      }
      byCasual.set(r.casualWorkerId, existing);
    });

    return Array.from(byCasual.entries())
      .map(([id, data]) => ({
        casualWorkerId: id,
        name: data.name,
        daysWorked: data.days.size,
        dailyPay: data.dailyPay,
        perKgPay: data.perKgPay,
        adjustments: data.adjustments,
        totalPay: data.dailyPay + data.perKgPay,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [weekRecords]);

  const payrollGrandTotal = useMemo(
    () => payrollSummary.reduce((sum, r) => sum + r.totalPay, 0),
    [payrollSummary]
  );

  // Detailed PDF — one row per attendance record
  const exportPayrollPdf = () => {
    if (weekRecords.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 12) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52); // green-800
    doc.text(`${selectedFarm} — Weekly Payroll Report`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`Week ${selectedWeek}, ${selectedYear} (${weekStr})`, margin, y);
    y += 8;

    // Sort records by name then date for PDF
    const sorted = [...weekRecords].sort((a, b) => {
      const nameComp = a.casualWorker.name.localeCompare(b.casualWorker.name);
      if (nameComp !== 0) return nameComp;
      return a.date.localeCompare(b.date);
    });

    // Table header
    const drawHeader = () => {
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y - 3.5, contentW, 5.5, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 65, 81);

      const headers = ["#", "Name", "Date", "Phase", "Activity", "Type", "Rate", "Units", "Adj.", "Amount"];
      const colX = [margin, margin + 8, margin + 58, margin + 80, margin + 110, margin + 155, margin + 175, margin + 200, margin + 220, margin + 240];
      headers.forEach((h, i) => doc.text(h, colX[i] + 1, y));
      y += 5;
    };

    drawHeader();

    // Detail rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(31, 41, 55);

    const colX = [margin, margin + 8, margin + 58, margin + 80, margin + 110, margin + 155, margin + 175, margin + 200, margin + 220, margin + 240];

    sorted.forEach((r, idx) => {
      if (checkPage(5)) drawHeader();

      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 3.2, contentW, 4.5, "F");
      }

      doc.setTextColor(31, 41, 55);
      doc.text(String(idx + 1), colX[0] + 1, y);
      doc.text(r.casualWorker.name.substring(0, 30), colX[1] + 1, y);
      doc.text(r.date, colX[2] + 1, y);
      doc.text(getPhaseLabel(r.farmPhaseId).substring(0, 18), colX[3] + 1, y);
      doc.text(r.activity.substring(0, 25), colX[4] + 1, y);
      doc.text(r.rateType === "daily" ? "Daily" : "Per kg", colX[5] + 1, y);
      doc.text(r.rate.toLocaleString(), colX[6] + 1, y);
      doc.text(String(r.units), colX[7] + 1, y);
      if (r.adjustment > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`-${r.adjustment.toLocaleString()}`, colX[8] + 1, y);
        doc.setTextColor(31, 41, 55);
      } else {
        doc.text("—", colX[8] + 1, y);
      }
      doc.setFont("helvetica", "bold");
      doc.text(r.amount.toLocaleString(), colX[9] + 1, y);
      doc.setFont("helvetica", "normal");
      y += 4.5;
    });

    // Grand total
    y += 2;
    checkPage(6);
    doc.setFillColor(220, 252, 231); // green-100
    doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52); // green-800
    doc.text("GRAND TOTAL", colX[0] + 1, y);
    doc.text(`${weekRecords.length} entries`, colX[4] + 1, y);
    doc.text(payrollGrandTotal.toLocaleString() + " RWF", colX[9] + 1, y);

    doc.save(`Payroll-${selectedFarm}-W${selectedWeek}-${selectedYear}.pdf`);
  };

  if (weekRecords.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Weekly Payroll Summary — Week {selectedWeek}
        </h3>
        <button
          onClick={exportPayrollPdf}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
        >
          Export PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2.5 px-3 font-medium text-gray-600">Name</th>
              <th className="text-center py-2.5 px-3 font-medium text-gray-600">Days</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-600">Daily Pay</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-600">Per-kg Pay</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-600">Adjustments</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-600">Total (RWF)</th>
            </tr>
          </thead>
          <tbody>
            {payrollSummary.map((row) => (
              <tr key={row.casualWorkerId} className="border-b border-gray-100">
                <td className="py-2 px-3 font-medium">{row.name}</td>
                <td className="py-2 px-3 text-center">{row.daysWorked}</td>
                <td className="py-2 px-3 text-right">{row.dailyPay.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">{row.perKgPay.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-red-600">
                  {row.adjustments > 0 ? `-${row.adjustments.toLocaleString()}` : "—"}
                </td>
                <td className="py-2 px-3 text-right font-semibold">{row.totalPay.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-green-50 font-bold">
              <td className="py-2.5 px-3">GRAND TOTAL</td>
              <td className="py-2.5 px-3 text-center">
                {payrollSummary.reduce((sum, r) => sum + r.daysWorked, 0)}
              </td>
              <td className="py-2.5 px-3 text-right">
                {payrollSummary.reduce((sum, r) => sum + r.dailyPay, 0).toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right">
                {payrollSummary.reduce((sum, r) => sum + r.perKgPay, 0).toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right text-red-600">
                {payrollSummary.reduce((sum, r) => sum + r.adjustments, 0) > 0
                  ? `-${payrollSummary.reduce((sum, r) => sum + r.adjustments, 0).toLocaleString()}`
                  : "—"}
              </td>
              <td className="py-2.5 px-3 text-right text-green-700">
                {payrollGrandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
