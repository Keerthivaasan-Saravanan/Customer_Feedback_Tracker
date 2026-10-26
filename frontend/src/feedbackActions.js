import { api } from "./api.js";
import { NEXT_STATUS } from "./constants.js";
import { toCsv } from "./utils/format.js";

const EXPORT_PAGE_SIZE = 100;

export function advanceStatus(item) {
  const next = NEXT_STATUS[item.status];
  if (!next) {
    return Promise.reject(new Error("Resolved feedback is final and cannot change status."));
  }
  return api.updateStatus(item.id, next);
}

export function deleteFeedback(item) {
  return api.deleteFeedback(item.id);
}

/** Downloads every record matching the filters (all pages) as a CSV file. */
export async function exportFeedbackCsv(filters) {
  const records = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await api.listFeedback({ ...filters, limit: EXPORT_PAGE_SIZE, offset });
    records.push(...page.items);
    total = page.total;
    if (page.items.length === 0) break;
    offset += EXPORT_PAGE_SIZE;
  }

  const blob = new Blob([`﻿${toCsv(records)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return records.length;
}
