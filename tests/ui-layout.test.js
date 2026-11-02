import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("calendar redesign keeps one accessible control per function", () => {
  for (const id of [
    "calendar-prev", "calendar-next", "calendar-title",
    "calendar-more-menu", "calendar-month-jump", "calendar-this-month",
    "calendar-reset", "calendar-quick-actions", "calendar-meta",
    "holiday-list", "holiday-list-more", "holiday-note",
  ]) {
    const matches = html.match(new RegExp('id="' + id + '"', "g")) || [];
    assert.equal(matches.length, 1, id);
  }
});

test("calendar primary controls are compact and duplicated month controls are not in the toolbar", () => {
  assert.ok(html.includes('<details id="calendar-more-menu"'));
  assert.ok(html.includes('data-cal-quick="safe"'));
  assert.ok(html.includes('data-cal-quick="7"'));
  assert.ok(html.includes('data-cal-quick="14"'));
  assert.ok(!html.includes('data-cal-quick="next-month"'), "next-month is covered by the arrow");
  assert.ok(!html.includes('class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"'));
});

test("sidebar starts with only three holidays and has expandable supporting details", () => {
  assert.ok(script.includes("upcoming.slice(0, 3)"));
  assert.ok(html.includes('id="holiday-list-more"'));
  assert.ok(html.includes("Nguồn và lưu ý lịch nghỉ"));
  assert.ok(html.includes("Quy tắc báo trước"));
});

test("calendar meta does not repeat the full attendance legend in colored pills", () => {
  assert.ok(!script.includes('chip("An toàn"'));
  assert.ok(!script.includes('chip("Cảnh báo"'));
  assert.ok(!script.includes('chip("Vi phạm"'));
});
