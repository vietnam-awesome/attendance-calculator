import { getHolidaysOnDate } from "./vietnam-holidays.js";

// Calendar uses the standard Monday–Friday workweek for planning. This is
// intentionally independent from organization-specific attendance rules.
export function isWeekend(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return date.getDay() === 0 || date.getDay() === 6;
}

export function getCalendarDayKind(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "invalid";
  const holiday = getHolidaysOnDate(date)[0];
  if (holiday) return holiday.kind === "statutory" ? "holiday" : "reference-holiday";
  if (date.getDay() === 6) return "saturday";
  if (date.getDay() === 0) return "sunday";
  return "workday";
}

// Do not suggest a normal rest day or an officially observed fixed holiday as
// a date on which the user should submit a leave request.
// Reference-only public-sector schedules are NOT treated as mandatory rest days.
export function isLeaveCandidateDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || isWeekend(date)) {
    return false;
  }
  return !getHolidaysOnDate(date).some((holiday) => holiday.kind === "statutory");
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function calendarDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

// A day outside the viewed month is a placeholder, never an interactive date.
// All past dates use one neutral style, even if they were weekends or holidays.
// Use both today's date and the chosen request date as the earliest selectable
// boundary, so manual changes cannot accidentally enable dates in the past.
export function getCalendarCellState(date, viewMonth, requestDate, today) {
  if (!validDate(date) || !validDate(viewMonth) || !validDate(today)) {
    return {
      kind: "outside", inMonth: false, past: false,
      selectable: false, showIndicators: false,
    };
  }
  const inMonth = date.getFullYear() === viewMonth.getFullYear() &&
    date.getMonth() === viewMonth.getMonth();
  const cutoff = Math.max(
    calendarDayNumber(today),
    validDate(requestDate) ? calendarDayNumber(requestDate) : -Infinity,
  );
  const past = inMonth && calendarDayNumber(date) < cutoff;
  const kind = !inMonth ? "outside" : past ? "past" : getCalendarDayKind(date);
  return {
    kind,
    inMonth,
    past,
    selectable: inMonth && !past && isLeaveCandidateDay(date),
    showIndicators: inMonth && !past,
  };
}
