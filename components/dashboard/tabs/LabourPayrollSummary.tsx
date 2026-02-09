"use client";

import { useMemo } from "react";
import jsPDF from "jspdf";

interface AttendanceRecordItem {
  id: number;
  casualWorkerId: number;
  casualWorker: { name: string; nationalId: string | null };
  date: string;
  rateType: string;
  amount: number;
  adjustment: number;
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
}

export default function LabourPayrollSummary({
  weekRecords,
  selectedFarm,
  selectedWeek,
  selectedYear,
  weekStr,
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

  const exportPayrollPdf = () => {
    if (payrollSummary.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 12) {
        doc.addPage();
        y = margin;
      }
    };

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`${selectedFarm} — Weekly Payroll Report`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`Week ${selectedWeek}, ${selectedYear} (${weekStr})`, margin, y);
    y += 8;

    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);

    const cols = [margin, margin + 80, margin + 100, margin + 130, margin + 160, margin + 190];
    const headers = ["Name", "Days", "Daily Pay (RWF)", "Per-kg Pay (RWF)", "Adjustments (RWF)", "Total (RWF)"];
    headers.forEach((h, i) => doc.text(h, cols[i] + 1, y));
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(31, 41, 55);

    for (const row of payrollSummary) {
      checkPage(5);
      doc.text(row.name, cols[0] + 1, y);
      doc.text(String(row.daysWorked), cols[1] + 1, y);
      doc.text(row.dailyPay.toLocaleString(), cols[2] + 1, y);
      doc.text(row.perKgPay.toLocaleString(), cols[3] + 1, y);
      doc.text(row.adjustments.toLocaleString(), cols[4] + 1, y);
      doc.text(row.totalPay.toLocaleString(), cols[5] + 1, y);
      y += 4.5;
    }

    y += 1;
    checkPage(6);
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.text("GRAND TOTAL", cols[0] + 1, y);
    doc.text(payrollGrandTotal.toLocaleString() + " RWF", cols[5] + 1, y);

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
            <tr className="bg-purple-50 font-bold">
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
              <td className="py-2.5 px-3 text-right text-purple-700">
                {payrollGrandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
