import { inclusiveDays, parseISODate, toISODate } from "./attendance-rules.js";

// On every visit the reference day represents *today*, not a historical value
// persisted in localStorage. A future date explicitly chosen by the user is kept.
export function restorePlanningDates({
  today,
  savedStart,
  savedEnd,
  fallbackStart,
  multi = false,
}) {
  const selected = parseISODate(savedStart);
  const selectedEnd = parseISODate(savedEnd);
  if (!(today instanceof Date) || Number.isNaN(today.getTime()) ||
      !(fallbackStart instanceof Date) || Number.isNaN(fallbackStart.getTime())) {
    throw new TypeError("Valid today and fallbackStart dates are required.");
  }
  const isFuture = selected && selected >= today;
  const start = isFuture ? selected : fallbackStart;
  const oldDuration = multi && selected && selectedEnd
    ? Math.min(400, Math.max(1, inclusiveDays(selected, selectedEnd)))
    : 1;
  const end = !multi
    ? start
    : isFuture && selectedEnd && selectedEnd >= start
      ? selectedEnd
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + oldDuration - 1);
  return {
    requestDate: toISODate(today),
    startDate: toISODate(start),
    endDate: toISODate(end),
    resetPastSelection: !isFuture,
  };
}

// Calendar always opens on the user's present calendar month. Manually chosen
// future dates are still retained and can be reached with "Về ngày đã chọn".
export function initialCalendarMonth(today) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) return null;
  return new Date(today.getFullYear(), today.getMonth(), 1);
}
