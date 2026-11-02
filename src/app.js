import {
  RULES,
  evaluateAttendance,
  formatDateVN,
  getEvaluationPeriod,
  getViolationLevel,
  parseISODate,
  toISODate,
} from "./attendance-rules.js";
import {
  getHolidaysOnDate,
  getUpcomingVietnamHolidays,
  getVietnamHolidays,
  isVerifiedLunarHolidayYear,
} from "./vietnam-holidays.js";

const $ = (selector) => document.querySelector(selector);

const form = $("#calculator-form");
const pointsInput = $("#current-points");
const typeInput = $("#event-type");
const requestInput = $("#request-date");
const startInput = $("#start-date");
const endInput = $("#end-date");
const endField = $("#end-field");
const noContactInput = $("#no-contact");
const result = $("#result");
const periodEl = $("#evaluation-period");
const pointsBadge = $("#points-badge");
const pointsBar = $("#points-bar");
const currentLevelEl = $("#current-level");
const policyHint = $("#policy-hint");
const quickDateButtons = $("#quick-date-buttons");
const referenceTodayButton = $("#reference-today-btn");
const calendarGrid = $("#calendar-grid");
const calendarTitle = $("#calendar-title");
const calendarMeta = $("#calendar-meta");
const calendarPrev = $("#calendar-prev");
const calendarNext = $("#calendar-next");
const calendarReset = $("#calendar-reset");
const holidayList = $("#holiday-list");
const holidayNote = $("#holiday-note");

const STORAGE_KEY = "attendance-calculator-v4";
const DAY_MS = 86_400_000;
let calendarViewDate = null;
let activeHolidayAnchor = null;

// Render into <body>, outside the calendar's overflow-hidden card, so tooltips
// remain visible at the edges of the month and are not cut off.
const holidayPopover = document.createElement("div");
holidayPopover.id = "calendar-holiday-tooltip";
holidayPopover.className = "holiday-popover";
holidayPopover.setAttribute("role", "tooltip");
holidayPopover.hidden = true;
document.body.append(holidayPopover);

function hideHolidayPopover() {
  holidayPopover.hidden = true;
  activeHolidayAnchor = null;
}

function appendPopoverText(parent, className, value) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = value;
  parent.append(element);
}

function showHolidayPopover(anchor) {
  if (!anchor || !anchor.isConnected) return;
  const day = parseISODate(anchor.dataset.holidayDate);
  if (!day) return;
  const holidays = getHolidaysOnDate(day);
  if (!holidays.length) return;
  if (activeHolidayAnchor === anchor && !holidayPopover.hidden) return;

  activeHolidayAnchor = anchor;
  holidayPopover.replaceChildren();
  for (const item of holidays) {
    const isReference = item.kind === "reference";
    const start = parseISODate(item.start);
    const end = parseISODate(item.end);
    appendPopoverText(
      holidayPopover,
      isReference ? "holiday-popover__eyebrow holiday-popover__eyebrow--reference" : "holiday-popover__eyebrow",
      isReference ? "Lịch nghỉ tham khảo" : "Ngày lễ chính thức",
    );
    appendPopoverText(holidayPopover, "holiday-popover__title", item.name);
    appendPopoverText(
      holidayPopover, "holiday-popover__date",
      start && end && item.start !== item.end
        ? \`\${formatDateVN(start)} – \${formatDateVN(end)}\`
        : formatDateVN(start),
    );
    appendPopoverText(
      holidayPopover, "holiday-popover__note",
      item.note ||
      (isReference
        ? "Lịch tham khảo của khối nhà nước, có thể khác tại doanh nghiệp."
        : "Ngày nghỉ lễ theo quy định. Lịch nghỉ bù thực tế có thể khác theo nơi làm việc."),
    );
  }

  holidayPopover.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const tipWidth = holidayPopover.offsetWidth;
  const tipHeight = holidayPopover.offsetHeight;
  const edge = 10;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - tipWidth / 2, edge),
    Math.max(edge, window.innerWidth - tipWidth - edge),
  );
  const above = rect.top - tipHeight - 10;
  const below = rect.bottom + 10;
  const top = above >= edge
    ? above
    : below + tipHeight <= window.innerHeight - edge
      ? below
      : Math.max(edge, Math.min(above, window.innerHeight - tipHeight - edge));
  holidayPopover.style.left = \`\${left}px\`;
  holidayPopover.style.top = \`\${top}px\`;
}

function localToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function daysBetween(later, earlier) {
  return later && earlier ? Math.round(utcDay(later) - utcDay(earlier)) : 0;
}

function sameDate(a, b) {
  return Boolean(a && b && utcDay(a) === utcDay(b));
}

function isBefore(a, b) {
  return Boolean(a && b && utcDay(a) < utcDay(b));
}

function inRange(date, start, end) {
  return Boolean(
    date &&
      start &&
      end &&
      utcDay(date) >= utcDay(start) &&
      utcDay(date) <= utcDay(end),
  );
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizedType(value = typeInput.value) {
  return value === "leave-multi" ? "leave" : value;
}

function durationDays() {
  if (typeInput.value !== "leave-multi") return 1;
  const start = parseISODate(startInput.value);
  const end = parseISODate(endInput.value);
  return start && end && end >= start ? daysBetween(end, start) + 1 : 1;
}

function evaluateCandidate(start, request, options = {}) {
  if (!start || !request) return null;

  const typeValue = options.typeValue ?? typeInput.value ?? "leave";
  const duration = Math.max(1, options.duration ?? durationDays());
  const end =
    typeValue === "leave-multi" ? addDays(start, duration - 1) : start;

  return evaluateAttendance({
    currentPoints: options.currentPoints ?? pointsInput.value ?? 96,
    type: normalizedType(typeValue),
    requestDate: request,
    startDate: start,
    endDate: end,
    noContact: options.noContact ?? noContactInput.checked ?? false,
  });
}

function earliestSafeDate(request, options = {}) {
  for (let offset = 0; request && offset <= 400; offset += 1) {
    const candidate = addDays(request, offset);
    const evaluation = evaluateCandidate(candidate, request, options);
    if (evaluation?.valid && evaluation.deduction === 0) return candidate;
  }
  return null;
}

function defaultSafeDate(today = localToday()) {
  return (
    earliestSafeDate(today, {
      typeValue: "leave",
      duration: 1,
      currentPoints: 96,
      noContact: false,
    }) || addDays(today, 7)
  );
}

function loadState() {
  const today = localToday();
  const safe = defaultSafeDate(today);
  const fallback = {
    currentPoints: 96,
    type: "leave",
    requestDate: toISODate(today),
    startDate: toISODate(safe),
    endDate: toISODate(safe),
    noContact: false,
  };

  try {
    return {
      ...fallback,
      ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}),
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      currentPoints: Number(pointsInput.value),
      type: typeInput.value,
      requestDate: requestInput.value,
      startDate: startInput.value,
      endDate: endInput.value,
      noContact: noContactInput.checked,
    }),
  );
}

function setInitialState() {
  const state = loadState();
  pointsInput.value = state.currentPoints;
  typeInput.value = state.type;
  requestInput.value = state.requestDate;
  startInput.value = state.startDate;
  endInput.value = state.endDate;
  noContactInput.checked = state.noContact;
  calendarViewDate = startOfMonth(
    parseISODate(state.startDate) || localToday(),
  );
  toggleEndDate();
}

function toggleEndDate() {
  const multi = typeInput.value === "leave-multi";
  endField.hidden = !multi;
  endInput.required = multi;

  if (multi && (!endInput.value || endInput.value < startInput.value)) {
    endInput.value = startInput.value;
  }

  if (typeInput.value === "leave") {
    policyHint.textContent = "Nghỉ 1 ngày cần báo trước ít nhất 1 tuần";
  } else if (multi) {
    policyHint.textContent = "Tự xác định theo tổng số ngày nghỉ";
  } else {
    policyHint.textContent = RULES[normalizedType()]?.shortLabel || "";
  }
}

function levelTone(level) {
  if (level === 0) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (level === 1) return "border-blue-400/20 bg-blue-400/10 text-blue-200";
  if (level === 2) return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

function renderTop(points, referenceDate) {
  const safePoints = Math.max(0, Math.min(100, Number(points) || 0));
  const level = getViolationLevel(safePoints);
  const period = getEvaluationPeriod(referenceDate || localToday());

  periodEl.textContent = `${formatDateVN(period.start)} – ${formatDateVN(period.end)}`;
  pointsBadge.textContent = safePoints;
  pointsBar.style.width = `${safePoints}%`;
  currentLevelEl.textContent = level.level ? level.name : "Chưa Mức 1";
  currentLevelEl.className = `inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${levelTone(level.level)}`;
}

function renderError(message) {
  result.innerHTML = `
    <div class="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600">!</div>
      <h2 class="mt-3 text-lg font-bold">Chưa thể tính</h2>
      <p class="mt-1.5 text-xs leading-5 text-slate-500">${message}</p>
    </div>
  `;
}

function holidayOverlaps(start, end) {
  if (!start || !end || end < start) return [];
  const firstYear = start.getFullYear();
  const lastYear = end.getFullYear();
  const from = toISODate(start);
  const to = toISODate(end);
  const matches = [];
  for (let year = firstYear; year <= lastYear && year < firstYear + 2; year += 1) {
    matches.push(...getVietnamHolidays(year).filter(
      (holiday) => holiday.start <= to && holiday.end >= from,
    ));
  }
  return matches;
}

function renderHolidayList(viewMonth) {
  if (!holidayList) return;
  const upcoming = getUpcomingVietnamHolidays(viewMonth, 7);
  holidayList.innerHTML = upcoming.length
    ? upcoming.map((holiday) => {
        const reference = holiday.kind === "reference";
        const start = parseISODate(holiday.start);
        const end = parseISODate(holiday.end);
        const label = end && toISODate(end) !== holiday.start
          ? `${formatDateVN(start)} – ${formatDateVN(end)}`
          : formatDateVN(start);
        return `<button type="button" data-holiday-go="${holiday.start}"
          title="${holiday.note || holiday.name}"
          class="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50">
          <span class="mt-1.5 size-2 shrink-0 rounded-full ${reference ? "bg-sky-400" : "bg-teal-500"}"></span>
          <span class="min-w-0 flex-1"><strong class="block text-xs font-semibold text-slate-800">${holiday.name}</strong>
            <span class="mt-0.5 block text-[10px] text-slate-500">${label}</span>
          </span></button>`;
      }).join("")
    : '<p class="py-2 text-xs text-slate-500">Chưa có ngày lễ trong dữ liệu hỗ trợ.</p>';
  if (holidayNote) {
    holidayNote.textContent = isVerifiedLunarHolidayYear(viewMonth.getFullYear())
      ? "Màu xanh lá: ngày lễ theo luật. Xanh dương: lịch khối nhà nước để tham khảo; lịch doanh nghiệp có thể khác."
      : "Ngày lễ cố định được hiển thị. Lịch Tết Âm lịch, Giỗ Tổ và các ngày nghỉ bù của năm này chưa được xác minh; không tự suy đoán.";
  }
}

function renderResult(data, requestDate, startDate) {
  if (!data.valid) {
    renderError(data.error);
    return;
  }

  const safe = data.deduction === 0;
  const lateBy = Math.max(0, daysBetween(requestDate, data.deadline));
  const notice = noContactInput.checked
    ? "Không báo"
    : `${Math.max(0, daysBetween(startDate, requestDate))} ngày`;
  const safeDate = safe ? startDate : earliestSafeDate(requestDate);
  const holidayMatches = holidayOverlaps(startDate, data.rule.type === "leave"
    ? parseISODate(endInput.value) && typeInput.value === "leave-multi"
      ? parseISODate(endInput.value)
      : startDate
    : startDate);
  const holidayNotice = holidayMatches.length
    ? `<div class="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs leading-5 text-teal-950">
        <strong>Trùng lịch lễ Việt Nam:</strong> ${holidayMatches.map((item) => item.name).join(", ")}.
        <p class="mt-1 text-teal-800">Ngày nghỉ lễ và lịch cơ quan nhà nước chỉ để tham khảo. Công cụ vẫn mô phỏng điểm theo ngày đăng ký, chưa tự trừ ngày lễ khỏi số ngày xin nghỉ. Kiểm tra lịch nghỉ tại nơi làm việc.</p>
      </div>`
    : "";

  const tone = safe
    ? {
        box: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
        badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        score: "text-emerald-600",
      }
    : data.deduction === 1
      ? {
          box: "border-amber-200 bg-amber-50/70 text-amber-950",
          badge: "bg-amber-50 text-amber-700 ring-amber-200",
          score: "text-amber-600",
        }
      : {
          box: "border-rose-200 bg-rose-50/70 text-rose-950",
          badge: "bg-rose-50 text-rose-700 ring-rose-200",
          score: "text-rose-600",
        };

  const title = safe
    ? "Ngày này đang an toàn"
    : data.deduction === 1
      ? "Ngày này sẽ bị trừ 1 điểm"
      : "Ngày này sẽ bị trừ 2 điểm";

  const timing = safe
    ? `Đủ thời gian báo trước. Hạn chót: <strong>${formatDateVN(data.deadline)}</strong>.`
    : `Hạn chót là <strong>${formatDateVN(data.deadline)}</strong>; mốc hiện tại đã chậm <strong>${lateBy} ngày</strong>.`;

  const suggestion =
    !safe && safeDate
      ? `
        <div class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Ngày an toàn gần nhất</div>
              <div class="mt-1 truncate text-sm font-bold text-emerald-950">${formatDateVN(safeDate)}</div>
            </div>
            <button type="button" data-use-safe-date="${toISODate(safeDate)}" class="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-2 text-[10px] font-bold text-white hover:bg-emerald-700">Chọn ngày này</button>
          </div>
        </div>
      `
      : "";

  result.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Kết quả dự kiến</p>
        <h2 class="mt-1.5 text-xl font-bold leading-6 tracking-tight text-slate-950">${title}</h2>
      </div>
      <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${tone.badge}">${safe ? "0 điểm" : `-${data.deduction} điểm`}</span>
    </div>

    <div class="mt-4 flex items-end justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Điểm sau dự kiến</div>
        <div class="mt-1 flex items-baseline gap-1"><strong class="text-4xl font-extrabold tracking-tight ${tone.score}">${data.projectedPoints}</strong><span class="text-xs font-semibold text-slate-400">/100</span></div>
      </div>
      <div class="pb-1 text-right text-[10px] font-medium text-slate-400">${data.currentPoints} → ${data.projectedPoints}</div>
    </div>

    <div class="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 bg-white">
      <div class="p-2.5"><span class="block text-[9px] uppercase tracking-wide text-slate-400">Mốc tính</span><strong class="mt-1 block text-xs text-slate-800">${formatDateVN(requestDate)}</strong></div>
      <div class="p-2.5"><span class="block text-[9px] uppercase tracking-wide text-slate-400">Ngày nghỉ</span><strong class="mt-1 block text-xs text-slate-800">${formatDateVN(startDate)}</strong></div>
      <div class="p-2.5"><span class="block text-[9px] uppercase tracking-wide text-slate-400">Báo trước</span><strong class="mt-1 block text-xs text-slate-800">${notice}</strong></div>
    </div>

    <div class="mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${tone.box}">${timing}</div>
    ${holidayNotice}
    ${suggestion}

    <details class="group mt-3 rounded-xl border border-slate-200 bg-white">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-slate-600">Chi tiết quy tắc<svg viewBox="0 0 20 20" fill="none" class="size-3.5 text-slate-400 transition group-open:rotate-180"><path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
      <div class="border-t border-slate-100 px-3 py-3"><div class="text-xs font-bold text-slate-800">${data.rule.noticeLabel}</div><p class="mt-1 text-[11px] leading-5 text-slate-500">${data.rule.label}. ${data.reason}</p></div>
    </details>
  `;
}

function chip(label, value, tone) {
  const className =
    {
      blue: "border-blue-100 bg-blue-50 text-blue-700",
      amber: "border-amber-100 bg-amber-50 text-amber-700",
      violet: "border-violet-100 bg-violet-50 text-violet-700",
      green: "border-emerald-100 bg-emerald-50 text-emerald-700",
      rose: "border-rose-100 bg-rose-50 text-rose-700",
      slate: "border-slate-200 bg-slate-100 text-slate-500",
    }[tone] || "border-slate-200 bg-slate-50 text-slate-600";

  return `
    <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${className}">
      <span class="font-medium opacity-70">${label}</span>${value}
    </span>
  `;
}

function renderCalendar(data, requestDate, startDate, endDate) {
  if (!calendarGrid) return;
  hideHolidayPopover();

  const focus = startDate || requestDate || localToday();
  if (!calendarViewDate) calendarViewDate = startOfMonth(focus);

  const month = startOfMonth(calendarViewDate);
  const deadline = data?.valid ? data.deadline : null;
  const actualEnd = endDate || startDate;
  renderHolidayList(month);

  calendarTitle.textContent = formatMonth(month);
  calendarMeta.innerHTML = [
    chip("Mốc tính", requestDate ? formatDateVN(requestDate) : "—", "blue"),
    chip("Hạn chót", deadline ? formatDateVN(deadline) : "—", "amber"),
    chip(
      "Nghỉ",
      startDate
        ? actualEnd && !sameDate(startDate, actualEnd)
          ? `${formatDateVN(startDate)} → ${formatDateVN(actualEnd)}`
          : formatDateVN(startDate)
        : "—",
      "violet",
    ),
    chip("An toàn", "0", "green"),
    chip("Cảnh báo", "-1", "amber"),
    chip("Vi phạm", "-2", "rose"),
    chip("Đã qua", "", "slate"),
  ].join("");

  const gridStart = addDays(month, -((month.getDay() + 6) % 7));
  const today = localToday();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const current =
      date.getMonth() === month.getMonth() &&
      date.getFullYear() === month.getFullYear();
    const beforeReference = current && requestDate && isBefore(date, requestDate);
    const evaluation =
      current && !beforeReference ? evaluateCandidate(date, requestDate) : null;
    const deduction = evaluation?.deduction;
    const holiday = current ? getHolidaysOnDate(date)[0] : null;
    const isPublicHoliday = Boolean(holiday);
    const isReferenceHoliday = holiday?.kind === "reference";

    let status = "border-transparent bg-slate-50/60 text-slate-300";
    let label = "";
    let selectable = false;

    if (current && isPublicHoliday) {
      status = isReferenceHoliday
        ? "calendar-holiday calendar-holiday--reference"
        : "calendar-holiday calendar-holiday--official";
      label = isReferenceHoliday ? "LỊCH NGHỈ" : "NGÀY LỄ";
      selectable = !beforeReference;
    } else if (beforeReference) {
      status = "border-slate-100 bg-slate-50/80 text-slate-300 opacity-60";
      label = "Đã qua";
    } else if (current && deduction === 0) {
      status = "border-emerald-100 bg-emerald-50/90 hover:bg-emerald-100";
      label = "An toàn";
      selectable = true;
    } else if (current && deduction === 1) {
      status = "border-amber-100 bg-amber-50/90 hover:bg-amber-100";
      label = "-1";
      selectable = true;
    } else if (current && deduction >= 2) {
      status = "border-rose-100 bg-rose-50/90 hover:bg-rose-100";
      label = "-2";
      selectable = true;
    } else if (current) {
      status = "border-slate-100 bg-white";
      selectable = Boolean(requestDate);
    }

    const classes = [
      "relative min-h-[58px] rounded-xl border p-1.5 text-left transition sm:min-h-[72px] sm:p-2",
      status,
      selectable || isPublicHoliday ? "cursor-pointer" : "cursor-default",
    ];

    if (inRange(date, startDate, actualEnd)) {
      classes.push("outline outline-2 outline-offset-[-2px] outline-violet-500");
    }
    if (sameDate(date, requestDate)) {
      classes.push("ring-2 ring-inset ring-blue-500");
    }
    if (sameDate(date, deadline)) {
      classes.push("shadow-[inset_0_0_0_2px_rgba(245,158,11,.8)]");
    }
    if (sameDate(date, today)) {
      classes.push(
        "after:pointer-events-none after:absolute after:inset-1 after:rounded-lg after:border after:border-dashed after:border-slate-500/60",
      );
    }

    const labelClass = beforeReference && !isPublicHoliday
      ? "text-slate-300"
      : isPublicHoliday
        ? isReferenceHoliday ? "text-sky-700" : "text-rose-700"
        : deduction === 0
        ? "text-emerald-700"
        : deduction === 1
          ? "text-amber-700"
          : "text-rose-700";

    const dataAttribute = selectable
      ? \`data-calendar-date="\${toISODate(date)}"\`
      : isPublicHoliday ? 'aria-disabled="true"' : "disabled";
    const holidayAttribute = isPublicHoliday
      ? \`data-holiday-date="\${toISODate(date)}" aria-describedby="calendar-holiday-tooltip" aria-label="\${formatDateVN(date)}, \${holiday.name}. \${isReferenceHoliday ? "Lịch tham khảo" : "Ngày lễ chính thức"}"\`
      : \`title="\${formatDateVN(date)}\${label ? \` · \${label}\` : ""}"\`;
    const holidayIcon = isReferenceHoliday
      ? '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h8"/></svg>'
      : '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.5 7.1.8-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9.3l7.1-.8z"/></svg>';

    cells.push(\`
      <button type="button" \${dataAttribute} \${holidayAttribute} class="\${classes.join(" ")}">
        <div class="flex items-start justify-between gap-1">
          <span class="flex size-6 items-center justify-center rounded-lg text-[11px] font-bold \${isPublicHoliday ? "calendar-holiday__date" : sameDate(date, today) ? "bg-slate-900 text-white" : current ? beforeReference ? "text-slate-300" : "text-slate-800" : "text-slate-300"}">\${date.getDate()}</span>
          <span class="flex items-center gap-1">
            \${isPublicHoliday ? \`<span class="calendar-holiday__icon">\${holidayIcon}</span>\` : ""}
            \${sameDate(date, requestDate) ? '<i class="size-1.5 rounded-full bg-blue-500"></i>' : ""}
            \${sameDate(date, deadline) ? '<i class="size-1.5 rounded-full bg-amber-500"></i>' : ""}
            \${inRange(date, startDate, actualEnd) ? '<i class="size-1.5 rounded-full bg-violet-500"></i>' : ""}
          </span>
        </div>
        \${isPublicHoliday
          ? \`<div class="mt-1 sm:mt-1.5">
              <span class="calendar-holiday__tag">\${label}</span>
              <span class="calendar-holiday__name">\${holiday.name}</span>
            </div>\`
          : label ? \`<div class="mt-2 hidden text-[8px] font-extrabold uppercase tracking-wide \${labelClass} sm:block">\${label}</div>\` : ""}
      </button>
    \`);
  }

  calendarGrid.innerHTML = cells.join("");
}

function calculate() {
  const request = parseISODate(requestInput.value);
  const start = parseISODate(startInput.value);
  const multi = typeInput.value === "leave-multi";
  const end = multi ? parseISODate(endInput.value) : start;

  if (!request) {
    renderError("Vui lòng chọn mốc tính hợp lệ.");
    renderCalendar(null, null, start, end);
    return;
  }

  const data = evaluateAttendance({
    currentPoints: pointsInput.value,
    type: normalizedType(),
    requestDate: request,
    startDate: start,
    endDate: end,
    noContact: noContactInput.checked,
  });

  renderTop(pointsInput.value, request);
  renderResult(data, request, start);
  renderCalendar(data, request, start, end);
  saveState();
}

function selectStartDate(date) {
  const oldDuration = durationDays();
  startInput.value = toISODate(date);
  endInput.value =
    typeInput.value === "leave-multi"
      ? toISODate(addDays(date, oldDuration - 1))
      : startInput.value;
  calendarViewDate = startOfMonth(date);
  calculate();
}

typeInput.addEventListener("change", () => {
  toggleEndDate();
  calculate();
});

startInput.addEventListener("change", () => {
  if (
    typeInput.value === "leave-multi" &&
    (!endInput.value || endInput.value < startInput.value)
  ) {
    endInput.value = startInput.value;
  }
  const date = parseISODate(startInput.value);
  if (date) calendarViewDate = startOfMonth(date);
  calculate();
});

quickDateButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-offset]");
  if (!button) return;
  selectStartDate(
    addDays(
      parseISODate(requestInput.value) || localToday(),
      Number(button.dataset.offset),
    ),
  );
});

referenceTodayButton.addEventListener("click", () => {
  requestInput.value = toISODate(localToday());
  calculate();
});

result.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-use-safe-date]");
  if (button) selectStartDate(parseISODate(button.dataset.useSafeDate));
});

holidayList?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-holiday-go]");
  if (!button) return;
  const date = parseISODate(button.dataset.holidayGo);
  if (!date) return;
  calendarViewDate = startOfMonth(date);
  calculate();
});

calendarGrid?.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const button = event.target.closest("button[data-holiday-date]");
  if (button) showHolidayPopover(button);
});

calendarGrid?.addEventListener("pointerout", (event) => {
  const button = event.target.closest("button[data-holiday-date]");
  if (button && (!event.relatedTarget || !button.contains(event.relatedTarget))) {
    hideHolidayPopover();
  }
});

calendarGrid?.addEventListener("focusin", (event) => {
  const button = event.target.closest("button[data-holiday-date]");
  if (button) showHolidayPopover(button);
});

calendarGrid?.addEventListener("focusout", (event) => {
  if (!event.relatedTarget || !calendarGrid.contains(event.relatedTarget)) {
    hideHolidayPopover();
  }
});

calendarGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-calendar-date], button[data-holiday-date]");
  if (!button) return;
  const day = button.dataset.holidayDate;
  const selectedDay = button.dataset.calendarDate;
  const touchOrKeyboard = window.matchMedia("(hover: none)").matches || event.detail === 0;
  if (selectedDay) {
    selectStartDate(parseISODate(selectedDay));
  }
  // A tap reveals the same rich tooltip; keyboard focus also reveals it.
  if (day && touchOrKeyboard) {
    const newButton = calendarGrid.querySelector(\`[data-holiday-date="\${day}"]\`);
    showHolidayPopover(newButton);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (activeHolidayAnchor && !calendarGrid.contains(event.target)) {
    hideHolidayPopover();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideHolidayPopover();
});
window.addEventListener("resize", hideHolidayPopover);
window.addEventListener("scroll", hideHolidayPopover, true);

calendarPrev?.addEventListener("click", () => {
  calendarViewDate = addMonths(
    calendarViewDate || startOfMonth(localToday()),
    -1,
  );
  calculate();
});

calendarNext?.addEventListener("click", () => {
  calendarViewDate = addMonths(
    calendarViewDate || startOfMonth(localToday()),
    1,
  );
  calculate();
});

calendarReset?.addEventListener("click", () => {
  calendarViewDate = startOfMonth(
    parseISODate(startInput.value) ||
      parseISODate(requestInput.value) ||
      localToday(),
  );
  calculate();
});

form.addEventListener("input", calculate);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

$("#reset-btn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  const today = localToday();
  const safe = defaultSafeDate(today);
  pointsInput.value = 96;
  typeInput.value = "leave";
  requestInput.value = toISODate(today);
  startInput.value = toISODate(safe);
  endInput.value = startInput.value;
  noContactInput.checked = false;
  calendarViewDate = startOfMonth(safe);
  toggleEndDate();
  calculate();
});

setInitialState();
calculate();