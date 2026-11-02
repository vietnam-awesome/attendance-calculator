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
