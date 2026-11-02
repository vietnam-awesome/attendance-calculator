import test from "node:test";
import assert from "node:assert/strict";
import { restorePlanningDates, initialCalendarMonth } from "../src/planner-state.js";

const d = (value) => {
  const [y, m, day] = value.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const restore = (saved = {}) => restorePlanningDates({
  today: d("2026-11-02"),
  savedStart: saved.start,
  savedEnd: saved.end,
  fallbackStart: d("2026-11-09"),
  multi: saved.multi ?? false,
});

test("stale August date resets to current November planning dates", () => {
  assert.deepEqual(restore({ start: "2026-08-21", end: "2026-08-21" }), {
    requestDate: "2026-11-02",
    startDate: "2026-11-09",
    endDate: "2026-11-09",
    resetPastSelection: true,
  });
});

test("future date selected intentionally survives reload, reference always today", () => {
  assert.deepEqual(restore({ start: "2026-12-15", end: "2026-12-15" }), {
    requestDate: "2026-11-02",
    startDate: "2026-12-15",
    endDate: "2026-12-15",
    resetPastSelection: false,
  });
});

test("preserve a multi-day range into the future", () => {
  const dates = restore({ start: "2026-12-15", end: "2026-12-18", multi: true });
  assert.equal(dates.startDate, "2026-12-15");
  assert.equal(dates.endDate, "2026-12-18");
});

test("when resetting stale multi-day date, preserve its planned duration", () => {
  const dates = restore({ start: "2026-08-21", end: "2026-08-23", multi: true });
  assert.equal(dates.startDate, "2026-11-09");
  assert.equal(dates.endDate, "2026-11-11");
});

test("invalid or missing localStorage dates fall back to current plan", () => {
  assert.equal(restore({ start: "2026-13-42" }).startDate, "2026-11-09");
  assert.equal(restore().startDate, "2026-11-09");
});

test("first calendar month follows today, including year turnover", () => {
  const a = initialCalendarMonth(d("2026-11-02"));
  const b = initialCalendarMonth(d("2027-01-01"));
  assert.equal(a.getMonth(), 10);
  assert.equal(a.getDate(), 1);
  assert.equal(b.getMonth(), 0);
  assert.equal(b.getFullYear(), 2027);
});
