import {
  RULES,
  evaluateAttendance,
  formatDateVN,
  getEvaluationPeriod,
  getViolationLevel,
  parseISODate,
  toISODate,
} from "./attendance-rules.js";

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

const STORAGE_KEY = "attendance-calculator-v3";
const DAY_MS = 24 * 60 * 60 * 1000;

function localToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function utcDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function calendarDaysBetween(later, earlier) {
  if (!later || !earlier) return 0;
  return Math.round(utcDayNumber(later) - utcDayNumber(earlier));
}

function loadState() {
  const today = localToday();
  const tomorrow = addDays(today, 1);
  const fallback = {
    currentPoints: 96,
    type: "leave",
    requestDate: toISODate(today),
    startDate: toISODate(tomorrow),
    endDate: toISODate(tomorrow),
    noContact: false,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentPoints: Number(pointsInput.value),
    type: typeInput.value,
    requestDate: requestInput.value,
    startDate: startInput.value,
    endDate: endInput.value,
    noContact: noContactInput.checked,
  }));
}

function setInitialState() {
  const state = loadState();
  pointsInput.value = state.currentPoints;
  typeInput.value = state.type;
  requestInput.value = state.requestDate;
  startInput.value = state.startDate;
  endInput.value = state.endDate;
  noContactInput.checked = state.noContact;
  toggleEndDate();
}

function normalizedType() {
  return typeInput.value === "leave-multi" ? "leave" : typeInput.value;
}

function toggleEndDate() {
  const isMultiDay = typeInput.value === "leave-multi";
  endField.hidden = !isMultiDay;
  endInput.required = isMultiDay;

  if (isMultiDay && (!endInput.value || endInput.value < startInput.value)) {
    endInput.value = startInput.value;
  }

  if (typeInput.value === "leave") {
    policyHint.textContent = "Nghỉ 1 ngày cần báo trước ít nhất 1 tuần";
    return;
  }
  if (typeInput.value === "leave-multi") {
    policyHint.textContent = "Tự xác định theo tổng số ngày nghỉ";
    return;
  }

  const base = RULES[normalizedType()];
  policyHint.textContent = base?.shortLabel || "";
}

function levelPillClass(level) {
  if (level === 0) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (level === 1) return "border-blue-400/20 bg-blue-400/10 text-blue-200";
  if (level === 2) return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

function renderTopSummary(points, referenceDate = localToday()) {
  const safePoints = Math.max(0, Math.min(100, Number(points) || 0));
  const level = getViolationLevel(safePoints);
  const period = getEvaluationPeriod(referenceDate);

  periodEl.textContent = `${formatDateVN(period.start)} – ${formatDateVN(period.end)}`;
  pointsBadge.textContent = safePoints;
  pointsBar.style.width = `${safePoints}%`;
  currentLevelEl.textContent = level.level === 0 ? "Chưa Mức 1" : level.name;
  currentLevelEl.className = `rounded-full border px-3 py-1.5 text-xs font-semibold ${levelPillClass(level.level)}`;
}

function renderError(message) {
  result.innerHTML = `
    <div class="flex min-h-[360px] flex-col items-center justify-center text-center">
      <div class="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
        <svg viewBox="0 0 24 24" fill="none" class="size-6" aria-hidden="true">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="mt-4 text-xl font-bold tracking-tight text-slate-950">Chưa thể tính</h2>
      <p class="mt-2 max-w-sm text-sm leading-6 text-slate-500">${message}</p>
    </div>
  `;
}

function renderResult(data, requestDate, startDate) {
  if (!data.valid) {
    renderError(data.error);
    return;
  }

  const isSafe = data.deduction === 0;
  const levelChanged = data.projectedLevel.level > data.currentLevel.level;
  const noticeDays = calendarDaysBetween(startDate, requestDate);
  const lateBy = Math.max(0, calendarDaysBetween(requestDate, data.deadline));

  const statusLabel = isSafe ? "Trong hạn" : `Dự kiến -${data.deduction} điểm`;
  const statusClass = isSafe
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
  const iconClass = isSafe
    ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
    : "bg-amber-50 text-amber-600 ring-amber-100";
  const scoreClass = isSafe ? "text-emerald-600" : "text-blue-600";
  const timingClass = isSafe
    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
    : "border-amber-200 bg-amber-50/70 text-amber-950";

  const timingMessage = data.timely
    ? `Bạn vẫn còn trong hạn. Mốc chậm nhất là <strong>${formatDateVN(data.deadline)}</strong>.`
    : `Mốc chậm nhất là <strong>${formatDateVN(data.deadline)}</strong>. Tính từ mốc đã chọn thì trễ <strong>${lateBy} ngày</strong>.`;

  const levelNote = levelChanged
    ? `<div class="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900"><strong>Cảnh báo:</strong> Điểm dự kiến chuyển từ ${data.currentLevel.name} sang ${data.projectedLevel.name}.</div>`
    : `<div class="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span class="text-slate-500">Vùng điểm sau dự kiến</span><strong class="text-slate-800">${data.projectedLevel.name} · ${data.projectedLevel.range}</strong></div>`;

  const scenarioLabel = noContactInput.checked ? "Không báo trước" : `${Math.max(0, noticeDays)} ngày`;

  result.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Kết quả dự kiến</p>
        <h2 class="mt-2 text-2xl font-bold tracking-tight text-slate-950">${isSafe ? "Không bị trừ điểm" : "Cần lưu ý mốc báo trước"}</h2>
      </div>
      <span class="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${statusClass}">${statusLabel}</span>
    </div>

    <div class="mt-7 flex items-center gap-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5 sm:p-6">
      <div class="flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconClass}">
        ${isSafe
          ? `<svg viewBox="0 0 24 24" fill="none" class="size-6" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" class="size-6" aria-hidden="true"><path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`}
      </div>
      <div class="min-w-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Điểm sau dự kiến</div>
        <div class="mt-1 flex items-baseline gap-1">
          <strong class="text-4xl font-extrabold tracking-tight ${scoreClass}">${data.projectedPoints}</strong>
          <span class="text-sm font-semibold text-slate-400">/100</span>
        </div>
        <div class="mt-1 text-xs font-medium text-slate-500">${data.currentPoints} → ${data.projectedPoints} điểm</div>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mốc tính</div>
        <div class="mt-1 text-sm font-bold text-slate-900">${formatDateVN(requestDate)}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ngày nghỉ</div>
        <div class="mt-1 text-sm font-bold text-slate-900">${formatDateVN(startDate)}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Báo trước</div>
        <div class="mt-1 text-sm font-bold text-slate-900">${scenarioLabel}</div>
      </div>
    </div>

    <div class="mt-5 rounded-2xl border px-4 py-4 text-sm leading-6 ${timingClass}">${timingMessage}</div>

    <div class="mt-5 rounded-2xl border border-slate-200 p-4">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" class="size-4" aria-hidden="true"><path d="M9 12.75 11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Quy tắc áp dụng</div>
          <div class="mt-1 text-sm font-bold text-slate-900">${data.rule.noticeLabel}</div>
          <p class="mt-1 text-xs leading-5 text-slate-500">${data.rule.label}. ${data.reason}</p>
        </div>
      </div>
    </div>

    ${levelNote}
  `;
}

function calculate() {
  const requestDate = parseISODate(requestInput.value);
  const startDate = parseISODate(startInput.value);
  const isMultiDay = typeInput.value === "leave-multi";
  const endDate = isMultiDay ? parseISODate(endInput.value) : startDate;

  if (!requestDate) {
    renderError("Vui lòng chọn mốc tính hợp lệ.");
    return;
  }

  const data = evaluateAttendance({
    currentPoints: pointsInput.value,
    type: normalizedType(),
    requestDate,
    startDate,
    endDate,
    noContact: noContactInput.checked,
  });

  renderTopSummary(pointsInput.value, requestDate);
  renderResult(data, requestDate, startDate);
  saveState();
}

typeInput.addEventListener("change", () => {
  toggleEndDate();
  calculate();
});

startInput.addEventListener("change", () => {
  if (typeInput.value === "leave-multi" && (!endInput.value || endInput.value < startInput.value)) {
    endInput.value = startInput.value;
  }
  calculate();
});

quickDateButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-offset]");
  if (!button) return;

  const baseDate = parseISODate(requestInput.value) || localToday();
  const targetDate = addDays(baseDate, Number(button.dataset.offset));
  startInput.value = toISODate(targetDate);
  if (typeInput.value !== "leave-multi") {
    endInput.value = startInput.value;
  } else if (!endInput.value || endInput.value < startInput.value) {
    endInput.value = startInput.value;
  }
  calculate();
});

referenceTodayButton.addEventListener("click", () => {
  requestInput.value = toISODate(localToday());
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
  const tomorrow = addDays(today, 1);
  pointsInput.value = 96;
  typeInput.value = "leave";
  requestInput.value = toISODate(today);
  startInput.value = toISODate(tomorrow);
  endInput.value = startInput.value;
  noContactInput.checked = false;
  toggleEndDate();
  calculate();
});

setInitialState();
calculate();
