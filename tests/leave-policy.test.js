import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLeavePolicy, connectsToHoliday, countWeekdays } from "../src/leave-policy.js";
import { parseISODate as d, toISODate } from "../src/attendance-rules.js";

const base = {
  kind: "summer",
  role: "staff",
  fullTimeDate: d("2025-01-01"),
  requestDate: d("2026-07-01"),
  startDate: d("2026-08-03"),
  endDate: d("2026-08-07"),
  approved: true,
};
const run = (changes = {}) => evaluateLeavePolicy({ ...base, ...changes });

test("five working days, tenure, and one month notice can qualify with approval", () => {
  const p = run();
  assert.equal(p.valid, true);
  assert.equal(p.status, "approved");
  assert.equal(p.workdays, 5);
  assert.equal(toISODate(p.noticeDeadline), "2026-07-03");
});
test("an unapproved summer plan is not declared approved", () => {
  assert.equal(run({ approved: false }).status, "review");
});
test("staff member without full-time date needs review", () => {
  assert.equal(run({ fullTimeDate: null }).status, "review");
});
test("chief or manager must request summer leave two months ahead", () => {
  const p = run({ role: "chief" });
  assert.equal(toISODate(p.noticeDeadline), "2026-06-03");
  assert.equal(p.status, "restricted");
});
test("summer leave requires six calendar months as full-time employee", () => {
  assert.equal(run({ fullTimeDate: d("2026-04-01") }).status, "restricted");
});
test("summer leave can only be used once and not during handover", () => {
  assert.equal(run({ summerUsed: true }).status, "restricted");
  assert.equal(run({ handover: true }).status, "restricted");
});
test("summer leave must fall within June to October, no more than five weekdays", () => {
  assert.equal(run({ startDate: d("2026-11-02"), endDate: d("2026-11-06") }).status, "restricted");
  assert.equal(run({ endDate: d("2026-08-10") }).status, "restricted");
  assert.equal(countWeekdays(d("2026-08-03"), d("2026-08-09")), 5);
});
test("summer leave plus annual leave defaults to restricted, even if attendance points are safe", () => {
  assert.equal(run({ attachAnnual: true }).status, "restricted");
  assert.equal(run({ attachAnnual: true, forceMajeure: true }).status, "review");
});
test("summer leave adjoining holiday through weekend is restricted", () => {
  const p = run({
    startDate: d("2026-08-24"), endDate: d("2026-08-28"),
    holidayStart: d("2026-08-31"), holidayEnd: d("2026-09-02"),
    requestDate: d("2026-07-01"),
  });
  assert.equal(p.connectedHoliday, true);
  assert.equal(p.status, "restricted");
});
test("a workday gap breaks direct adjacency", () => {
  assert.equal(connectsToHoliday(d("2026-08-26"), d("2026-08-27"), d("2026-08-31"), d("2026-09-02")), false);
});
test("annual leave next to national holiday is permissible for review, not automatically rejected", () => {
  const p = run({
    kind: "annual", startDate: d("2026-08-31"), endDate: d("2026-09-01"),
    holidayStart: d("2026-09-02"), holidayEnd: d("2026-09-02"),
  });
  assert.equal(p.status, "approved");
  assert.equal(p.connectedHoliday, true);
  assert.equal(evaluateLeavePolicy({ ...base, kind: "annual", approved: false }).status, "review");
});
test("bad holiday range and invalid date range are rejected", () => {
  assert.equal(run({ holidayStart: d("2026-09-02") }).valid, false);
  assert.equal(run({ startDate: d("2026-08-10"), endDate: d("2026-08-09") }).valid, false);
});
