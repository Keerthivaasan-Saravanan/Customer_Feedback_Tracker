// Pure formatting helpers. No DOM or React imports, so they are unit-testable in Node.

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function timeAgo(iso, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** Converts backend trend points ({ week_start: "YYYY-MM-DD", count }) into chart buckets. */
export function trendBuckets(points) {
  return points.map((point) => {
    const [year, month, day] = point.week_start.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    return {
      start: point.week_start,
      label: start.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      count: point.count,
    };
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_HEADER = [
  "ID",
  "Submitted",
  "Customer name",
  "Customer email",
  "Product",
  "Rating",
  "Category",
  "Status",
  "Comments",
];

export function toCsv(records) {
  const rows = records.map((r) => [
    r.id,
    r.submitted_at,
    r.customer_name,
    r.customer_email,
    r.product,
    r.rating,
    r.category,
    r.status,
    r.comments,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
