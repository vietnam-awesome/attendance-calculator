import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAttendance,
  getViolationLevel,
  parseISODate,
  subtractMonthsClamped,
  toISODate,
} from "../src/attendance-rules.js";

const d = parseISODate;

function run(overrides = {}) {
  return evaluateAttendance({
    currentPoints: 96,
    type: "half",
    requestDate: d("2026-08-19"),
    startDate: d("2026-08-21"),
    endDate: d("2026-08-21"),
    noContact: false,
    ...overrides,
  });
}

test("half-day requested two days before is compliant", () => {
  const result = run();
  assert.equal(result.deduction, 0);
  assert.equal(result.projectedPoints, 96);
});

test("half-day requested one day before costs one point", () => {
  const result = run({ requestDate: d("2026-08-20") });
  assert.equal(result.deduction, 1);
  assert.equal(result.projectedPoints, 95);
});

test("same-day request costs two points", () => {
  const result = run({ requestDate: d("2026-08-21") });
  assert.equal(result.deduction, 2);
  assert.equal(result.projectedPoints, 94);
});

test("one-day leave requested seven days before is compliant", () => {
  const result = run({
    type: "leave",
    requestDate: d("2026-08-14"),
    startDate: d("2026-08-21"),
    endDate: d("2026-08-21"),
  });
  assert.equal(result.deduction, 0);
});

test("one-day leave requested six days before costs one point", () => {
  const result = run({
    type: "leave",
    requestDate: d("2026-08-15"),
    startDate: d("2026-08-21"),
    endDate: d("2026-08-21"),
  });
  assert.equal(result.deduction, 1);
});

test("two-day leave requested late costs two points", () => {
  const result = run({
    type: "leave",
    requestDate: d("2026-08-15"),
    startDate: d("2026-08-21"),
    endDate: d("2026-08-22"),
  });
  assert.equal(result.deduction, 2);
});

test("eight-day leave requires one month notice", () => {
  const result = run({
    type: "leave",
    requestDate: d("2026-07-21"),
    startDate: d("2026-08-21"),
    endDate: d("2026-08-28"),
  });
  assert.equal(result.deduction, 0);
  assert.equal(toISODate(result.deadline), "2026-07-21");
});

test("no contact always costs two points", () => {
  const result = run({ requestDate: d("2026-08-01"), noContact: true });
  assert.equal(result.deduction, 2);
});

test("violation level boundaries match the table", () => {
  assert.equal(getViolationLevel(89).level, 0);
  assert.equal(getViolationLevel(88).level, 1);
  assert.equal(getViolationLevel(77).level, 1);
  assert.equal(getViolationLevel(76).level, 2);
  assert.equal(getViolationLevel(64).level, 3);
  assert.equal(getViolationLevel(52).level, 4);
  assert.equal(getViolationLevel(40).level, 5);
});

test("month subtraction clamps end-of-month safely", () => {
  assert.equal(toISODate(subtractMonthsClamped(d("2026-03-31"), 1)), "2026-02-28");
});
