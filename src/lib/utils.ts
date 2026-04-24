import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadJson(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(data: any, filename: string) {
  // Simple CSV conversion for line items
  if (!data.line_items || !Array.isArray(data.line_items)) return;

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = ["Description", "Quantity", "Unit Price", "Amount"];
  const rows = data.line_items.map((item: any) => [
    escapeCsv(item.description),
    escapeCsv(item.quantity),
    escapeCsv(item.unit_price),
    escapeCsv(item.amount)
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map((row: any) => row.join(","))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBulkCsv(invoices: any[], filename: string) {
  if (!invoices.length) return;

  const headers = ["ID", "FileName", "Date", "Merchant", "Number", "Currency", "Subtotal", "Tax", "Total", "Category", "Summary"];
  
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = invoices.map((inv: any) => [
    escapeCsv(inv.id),
    escapeCsv(inv.fileName),
    escapeCsv(inv.structured_data.invoice_details.date),
    escapeCsv(inv.structured_data.merchant.name),
    escapeCsv(inv.structured_data.invoice_details.number),
    escapeCsv(inv.structured_data.invoice_details.currency),
    escapeCsv(inv.structured_data.totals.subtotal),
    escapeCsv(inv.structured_data.totals.tax_amount),
    escapeCsv(inv.structured_data.totals.total_amount),
    escapeCsv(inv.category || "Uncategorized"),
    escapeCsv(inv.summary)
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
