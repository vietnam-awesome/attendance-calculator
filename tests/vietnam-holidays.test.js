import test from "node:test";
import assert from "node:assert/strict";
import {
  getVietnamHolidays, getHolidaysOnDate, getUpcomingVietnamHolidays,
  isVerifiedLunarHolidayYear, localISO,
} from "../src/vietnam-holidays.js";

const localDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

test("fixed holidays are available without an external API and sorted", () => {
  const events = getVietnamHolidays(2026);
  const dates = events.map((e) => e.start);
  assert.deepEqual(dates, [...dates].sort());
  for (const id of ["new-year", "reunification", "labor", "national-day", "culture"]) {
    assert.ok(events.some((x) => x.id === id));
  }
});

test("Vietnam Culture Day is a paid public holiday since 2026, not earlier", () => {
  assert.equal(getVietnamHolidays(2025).some((x) => x.id === "culture"), false);
  assert.equal(getVietnamHolidays(2026).find((x) => x.id === "culture").start, "2026-11-24");
  assert.equal(getVietnamHolidays(2027).find((x) => x.id === "culture").start, "2027-11-24");
});

test("known Hung Kings dates agree with verified Vietnamese lunar calendars", () => {
  assert.equal(getVietnamHolidays(2026).find((x) => x.id === "hung-kings").start, "2026-04-26");
  assert.equal(getVietnamHolidays(2027).find((x) => x.id === "hung-kings").start, "2027-04-16");
  assert.equal(isVerifiedLunarHolidayYear(2028), false);
  assert.equal(getVietnamHolidays(2028).some((x) => x.id === "hung-kings"), false);
});

test("Tet public-sector schedule is reference and includes announced dates", () => {
  const tet = getVietnamHolidays(2027).find((x) => x.id === "tet-government");
  assert.equal(tet.start, "2027-02-04");
  assert.equal(tet.end, "2027-02-10");
  assert.equal(tet.kind, "reference");
  assert.ok(getHolidaysOnDate(localDate("2027-02-10")).some((e) => e.id === "tet-government"));
  assert.equal(getVietnamHolidays(2028).some((x) => x.id === "tet-government"), false);
});

test("national day additional day is marked as public-sector reference", () => {
  const holidays = getHolidaysOnDate(localDate("2026-09-01"));
  assert.ok(holidays.some((x) => x.id === "national-adjacent-government" && x.kind === "reference"));
  assert.ok(getHolidaysOnDate(localDate("2026-08-31")).some((x) => x.id === "national-swap-government"));
});

test("upcoming holidays keep in-progress periods and cross New Year", () => {
  const start = getUpcomingVietnamHolidays(localDate("2026-11-02"), 4);
  assert.equal(start[0].id, "culture");
  assert.equal(start[1].id, "new-year");
  const inTet = getUpcomingVietnamHolidays(localDate("2027-02-07"), 1);
  assert.equal(inTet[0].id, "tet-government");
});

test("invalid input never fabricates a holiday", () => {
  assert.deepEqual(getVietnamHolidays(0), []);
  assert.deepEqual(getHolidaysOnDate(new Date(NaN)), []);
  assert.deepEqual(getUpcomingVietnamHolidays(new Date(NaN)), []);
  assert.equal(localISO(new Date(NaN)), "");
});
