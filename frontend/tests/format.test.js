import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { initials, percent, timeAgo, toCsv, trendBuckets } from "../src/utils/format.js";

describe("initials", () => {
  test("uses first and last name initials", () => {
    assert.equal(initials("Priya Nair"), "PN");
    assert.equal(initials("Mei Lin Chen"), "MC");
  });

  test("handles single names, extra spaces and empty input", () => {
    assert.equal(initials("Ravi"), "R");
    assert.equal(initials("  Omar   Haddad "), "OH");
    assert.equal(initials(""), "?");
  });
});

describe("percent", () => {
  test("rounds to the nearest whole percent", () => {
    assert.equal(percent(1, 3), 33);
    assert.equal(percent(2, 3), 67);
  });

  test("returns zero when the total is zero", () => {
    assert.equal(percent(5, 0), 0);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");

  test("describes recent times in minutes and hours", () => {
    assert.equal(timeAgo("2026-10-26T11:59:40Z", now), "just now");
    assert.equal(timeAgo("2026-10-26T11:30:00Z", now), "30m ago");
    assert.equal(timeAgo("2026-10-26T06:00:00Z", now), "6h ago");
  });

  test("describes older times in days", () => {
    assert.equal(timeAgo("2026-10-21T12:00:00Z", now), "5d ago");
  });
});

describe("trendBuckets", () => {
  test("maps backend trend points to labelled chart buckets", () => {
    const buckets = trendBuckets([
      { week_start: "2026-10-19", count: 2 },
      { week_start: "2026-10-26", count: 0 },
    ]);
    assert.equal(buckets.length, 2);
    assert.equal(buckets[0].start, "2026-10-19");
    assert.equal(buckets[0].count, 2);
    assert.equal(typeof buckets[1].label, "string");
    assert.ok(buckets[1].label.length > 0);
  });
});

describe("toCsv", () => {
  const record = {
    id: "FB-0001",
    submitted_at: "2026-09-02T09:15:00+00:00",
    customer_name: "Priya Nair",
    customer_email: "priya.nair@example.com",
    product: "Nimbus CRM",
    rating: 5,
    category: "Compliment",
    status: "Resolved",
    comments: 'Great, "very" useful\nthanks',
  };

  test("writes a header and escapes commas, quotes and newlines", () => {
    const csv = toCsv([record]);
    const [header, row] = csv.split("\r\n", 2);
    assert.equal(header, "ID,Submitted,Customer name,Customer email,Product,Rating,Category,Status,Comments");
    assert.ok(row.startsWith("FB-0001,"));
    assert.ok(csv.includes('"Great, ""very"" useful\nthanks"'));
  });

  test("returns only the header for no records", () => {
    assert.equal(toCsv([]).split("\r\n").length, 1);
  });
});
