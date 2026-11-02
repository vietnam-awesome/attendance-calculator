import test from "node:test";
import assert from "node:assert/strict";
import {
  getCalendarDayKind, getCalendarCellState, isLeaveCandidateDay, isWeekend,
  clampCalendarMonth, canVisitPreviousMonth, parseFutureCalendarMonth,
  nextLeaveCandidate,
} from "../src/calendar-days.js";

const date = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

test("Saturday and Sunday are rest days, while Monday is a workday", () => {
  assert.equal(getCalendarDayKind(date("2027-01-02")), "saturday");
  assert.equal(getCalendarDayKind(date("2027-01-03")), "sunday");
  assert.equal(getCalendarDayKind(date("2027-01-04")), "workday");
  assert.equal(isWeekend(date("2027-01-02")), true);
  assert.equal(isWeekend(date("2027-01-03")), true);
  assert.equal(isWeekend(date("2027-01-04")), false);
});

test("public holidays have priority when they fall on a weekend", () => {
  assert.equal(getCalendarDayKind(date("2026-04-26")), "holiday"); // Sunday / Hung Kings
  assert.equal(isLeaveCandidateDay(date("2026-04-26")), false);
});

test("candidate leave dates skip Saturday, Sunday, and statutory holidays", () => {
  assert.equal(isLeaveCandidateDay(date("2027-01-01")), false); // Friday, New Year
  assert.equal(isLeaveCandidateDay(date("2027-01-02")), false);
  assert.equal(isLeaveCandidateDay(date("2027-01-03")), false);
  assert.equal(isLeaveCandidateDay(date("2027-01-04")), true);
});

test("reference-only public-sector holiday is not automatically a mandatory rest day", () => {
  assert.equal(getCalendarDayKind(date("2026-08-31")), "reference-holiday");
  assert.equal(isLeaveCandidateDay(date("2026-08-31")), true);
});

test("invalid date is never a workday candidate", () => {
  assert.equal(getCalendarDayKind(new Date(NaN)), "invalid");
  assert.equal(isWeekend(new Date(NaN)), false);
  assert.equal(isLeaveCandidateDay(new Date(NaN)), false);
});

test("past weekends and public holidays are neutral, disabled, and marker-free", () => {
  const october = date("2026-10-01");
  const reference = date("2026-11-02");
  const today = date("2026-11-02");
  for (const day of ["2026-10-03", "2026-10-04", "2026-10-12", "2026-10-31"]) {
    const cell = getCalendarCellState(date(day), october, reference, today);
    assert.equal(cell.kind, "past");
    assert.equal(cell.inMonth, true);
    assert.equal(cell.past, true);
    assert.equal(cell.selectable, false);
    assert.equal(cell.showIndicators, false);
  }
});

test("next-month selection is not visible when browsing the previous month", () => {
  const october = date("2026-10-01");
  const cell = getCalendarCellState(
    date("2026-11-02"), october, date("2026-11-02"), date("2026-11-02"),
  );
  assert.deepEqual(cell, {
    kind: "outside", inMonth: false, past: false,
    selectable: false, showIndicators: false,
  });
});

test("past holidays lose colored priority but future holidays remain visible", () => {
  const old = getCalendarCellState(
    date("2026-04-26"), date("2026-04-01"), date("2026-11-02"), date("2026-11-02"),
  );
  const future = getCalendarCellState(
    date("2027-01-01"), date("2027-01-01"), date("2026-11-02"), date("2026-11-02"),
  );
  assert.equal(old.kind, "past");
  assert.equal(future.kind, "holiday");
  assert.equal(future.showIndicators, true);
  assert.equal(future.selectable, false);
});

test("the current day remains visible but cannot be selected on weekends", () => {
  const today = date("2027-01-02");
  const cell = getCalendarCellState(today, date("2027-01-01"), today, today);
  assert.equal(cell.kind, "saturday");
  assert.equal(cell.past, false);
  assert.equal(cell.showIndicators, true);
  assert.equal(cell.selectable, false);
});

test("manually chosen future reference also mutes earlier calendar days", () => {
  const cell = getCalendarCellState(
    date("2026-11-03"), date("2026-11-01"),
    date("2026-11-09"), date("2026-11-02"),
  );
  assert.equal(cell.kind, "past");
  assert.equal(cell.selectable, false);
  assert.equal(cell.showIndicators, false);
});

test("calendar cannot navigate into months before the current month", () => {
  const today = date("2026-11-02");
  assert.equal(canVisitPreviousMonth(date("2026-11-18"), today), false);
  assert.equal(canVisitPreviousMonth(date("2026-12-01"), today), true);
  const clamped = clampCalendarMonth(date("2026-10-15"), today);
  assert.deepEqual([clamped.getFullYear(), clamped.getMonth(), clamped.getDate()], [2026, 10, 1]);
});

test("native month picker rejects old months and malformed inputs, accepts future", () => {
  const today = date("2026-11-02");
  for (const input of ["2026-10", "2025-12", "2026-13", "2026-00", "bad", "2026-1", "2026-11-02"]) {
    assert.equal(parseFutureCalendarMonth(input, today), null, input);
  }
  const valid = parseFutureCalendarMonth("2027-01", today);
  assert.equal(valid.getFullYear(), 2027);
  assert.equal(valid.getMonth(), 0);
  assert.equal(parseFutureCalendarMonth("2026-11", today).getMonth(), 10);
});

test("quick selection advances past Saturday/Sunday and actual statutory holiday", () => {
  assert.equal(
    nextLeaveCandidate(date("2027-01-01"), { inclusive: true }).toLocaleDateString("en-CA"),
    date("2027-01-04").toLocaleDateString("en-CA"),
  );
  assert.equal(
    nextLeaveCandidate(date("2027-01-02"), { inclusive: false }).getDate(), 4,
  );
});

test("quick selection handles year boundary and invalid dates", () => {
  const value = nextLeaveCandidate(date("2026-12-31"), { inclusive: false });
  assert.equal(value.getFullYear(), 2027);
  assert.equal(value.getMonth(), 0);
  assert.equal(value.getDate(), 4);
  assert.equal(nextLeaveCandidate(new Date(NaN)), null);
});
