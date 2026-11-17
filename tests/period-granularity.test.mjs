import assert from "node:assert/strict";
import test from "node:test";
import {
  alignPreviousMonthToLatest,
  displayPeriod,
  isCompleteCalendarMonth,
  monthStart,
  periodKey,
  weekStart,
} from "../src/content/dashboard/period-granularity.js";

test("uses Friday as the business-week start", () => {
  assert.equal(weekStart("2026-11-16"), "2026-11-13");
  assert.equal(periodKey("2026-11-19", "week"), "2026-11-13");
});

test("groups calendar months from the first day of the month", () => {
  assert.equal(monthStart("2026-11-16"), "2026-11");
  assert.equal(periodKey("2026-09-01", "month"), "2026-09");
  assert.equal(displayPeriod("2026-09"), "2026/09");
});

test("only treats a month with its calendar month-end as complete", () => {
  assert.equal(isCompleteCalendarMonth("2026-10", [{credit_pass_date: "2026-10-31"}]), true);
  assert.equal(isCompleteCalendarMonth("2026-11", [{credit_pass_date: "2026-11-16"}]), false);
});

test("aligns the previous month to the latest month's observed day range", () => {
  const previousRows = ["2026-10-01", "2026-10-16", "2026-10-17", "2026-10-31"].map(credit_pass_date => ({credit_pass_date}));
  const latestRows = ["2026-11-01", "2026-11-16"].map(credit_pass_date => ({credit_pass_date}));
  const aligned = alignPreviousMonthToLatest(previousRows, latestRows);
  assert.deepEqual(aligned.previousRows.map(row => row.credit_pass_date), ["2026-10-01", "2026-10-16"]);
  assert.equal(aligned.startDay, 1);
  assert.equal(aligned.endDay, 16);
});
