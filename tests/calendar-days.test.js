import test from "node:test";
import assert from "node:assert/strict";
import { getCalendarDayKind, isLeaveCandidateDay, isWeekend } from "../src/calendar-days.js";

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
