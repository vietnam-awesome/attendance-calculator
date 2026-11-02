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

function firstOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Restrict calendar navigation to the current month and future months. This
// operates on month boundaries, not full timestamps, to avoid locale/time bugs.
export function clampCalendarMonth(target, today) {
  if (!validDate(target) || !validDate(today)) return null;
  const wanted = firstOfMonth(target);
  const minimum = firstOfMonth(today);
  return wanted < minimum ? minimum : wanted;
}

export function canVisitPreviousMonth(viewDate, today) {
  if (!validDate(viewDate) || !validDate(today)) return false;
  return firstOfMonth(viewDate) > firstOfMonth(today);
}

// Native input[type=month] uses YYYY-MM: validate rather than normalizing an
// invalid value (e.g., 2026-13) to an unrelated year.
export function parseFutureCalendarMonth(value, today) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
      !validDate(today)) return null;
  const [year, month] = value.split("-").map(Number);
  if (year < 1900 || year > 2100) return null;
  const target = new Date(year, month - 1, 1);
  return target < firstOfMonth(today) ? null : target;
}

export function nextLeaveCandidate(from, { inclusive = true, maxDays = 400 } = {}) {
  if (!validDate(from)) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + (inclusive ? 0 : 1));
  for (let i = 0; i <= maxDays; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (isLeaveCandidateDay(day)) return day;
  }
  return null;
}

// Render only the week rows actually required by a month. For example,
// October 2026 fits in five rows while November 2026 requires six.
export function calendarWeekCount(viewMonth) {
  if (!validDate(viewMonth)) return 0;
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Math.ceil((mondayOffset + daysInMonth) / 7);
}
