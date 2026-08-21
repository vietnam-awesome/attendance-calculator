import {
  RULES, evaluateAttendance, formatDateVN, getEvaluationPeriod,
  getViolationLevel, parseISODate, toISODate,
} from "./attendance-rules.js";

const $ = (s) => document.querySelector(s);
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

const STORAGE_KEY = "attendance-calculator-v4";
const DAY_MS = 86400000;
let calendarViewDate = null;

function localToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function utcDay(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS; }
function daysBetween(a, b) { return a && b ? Math.round(utcDay(a) - utcDay(b)) : 0; }
function sameDate(a, b) { return !!(a && b && utcDay(a) === utcDay(b)); }
function inRange(d, a, b) { return !!(d && a && b && utcDay(d) >= utcDay(a) && utcDay(d) <= utcDay(b)); }
function formatMonth(d) { return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(d); }
function normalizedType(v = typeInput.value) { return v === "leave-multi" ? "leave" : v; }

function durationDays() {
  if (typeInput.value !== "leave-multi") return 1;
  const a = parseISODate(startInput.value), b = parseISODate(endInput.value);
  return a && b && b >= a ? daysBetween(b, a) + 1 : 1;
}

function evaluateCandidate(start, request, opts = {}) {
  if (!start || !request) return null;
  const typeValue = opts.typeValue ?? typeInput.value ?? "leave";
  const duration = Math.max(1, opts.duration ?? durationDays());
  const end = typeValue === "leave-multi" ? addDays(start, duration - 1) : start;
  return evaluateAttendance({
    currentPoints: opts.currentPoints ?? pointsInput.value ?? 96,
    type: normalizedType(typeValue), requestDate: request, startDate: start, endDate: end,
    noContact: opts.noContact ?? noContactInput.checked ?? false,
  });
}

function earliestSafeDate(request, opts = {}) {
  for (let i = 0; request && i <= 400; i += 1) {
    const d = addDays(request, i), r = evaluateCandidate(d, request, opts);
    if (r?.valid && r.deduction === 0) return d;
  }
  return null;
}

function defaultSafeDate(today = localToday()) {
  return earliestSafeDate(today, { typeValue: "leave", duration: 1, currentPoints: 96, noContact: false }) || addDays(today, 7);
}

function loadState() {
  const today = localToday(), safe = defaultSafeDate(today);
  const fallback = { currentPoints: 96, type: "leave", requestDate: toISODate(today), startDate: toISODate(safe), endDate: toISODate(safe), noContact: false };
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}) }; }
  catch { return fallback; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentPoints: Number(pointsInput.value), type: typeInput.value, requestDate: requestInput.value,
    startDate: startInput.value, endDate: endInput.value, noContact: noContactInput.checked,
  }));
}
function setInitialState() {
  const s = loadState();
  pointsInput.value = s.currentPoints; typeInput.value = s.type; requestInput.value = s.requestDate;
  startInput.value = s.startDate; endInput.value = s.endDate; noContactInput.checked = s.noContact;
  calendarViewDate = startOfMonth(parseISODate(s.startDate) || localToday());
  toggleEndDate();
}

function toggleEndDate() {
  const multi = typeInput.value === "leave-multi";
  endField.hidden = !multi; endInput.required = multi;
  if (multi && (!endInput.value || endInput.value < startInput.value)) endInput.value = startInput.value;
  if (typeInput.value === "leave") policyHint.textContent = "Nghỉ 1 ngày cần báo trước ít nhất 1 tuần";
  else if (multi) policyHint.textContent = "Tự xác định theo tổng số ngày nghỉ";
  else policyHint.textContent = RULES[normalizedType()]?.shortLabel || "";
}

function renderTop(points, ref) {
  const p = Math.max(0, Math.min(100, Number(points) || 0));
  const level = getViolationLevel(p), period = getEvaluationPeriod(ref || localToday());
  periodEl.textContent = `${formatDateVN(period.start)} – ${formatDateVN(period.end)}`;
  pointsBadge.textContent = p; pointsBar.style.width = `${p}%`;
  currentLevelEl.textContent = level.level ? level.name : "Chưa Mức 1";
}
function renderError(msg) {
  result.innerHTML = `<div class="flex min-h-[360px] flex-col items-center justify-center text-center"><div class="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-black text-rose-600">!</div><h2 class="mt-4 text-xl font-bold">Chưa thể tính</h2><p class="mt-2 text-sm text-slate-500">${msg}</p></div>`;
}

function renderResult(data, request, start) {
  if (!data.valid) return renderError(data.error);
  const safe = data.deduction === 0, late = Math.max(0, daysBetween(request, data.deadline));
  const notice = noContactInput.checked ? "Không báo" : `${Math.max(0, daysBetween(start, request))} ngày`;
  const safeDate = safe ? start : earliestSafeDate(request);
  const tone = safe ? "emerald" : data.deduction === 1 ? "amber" : "rose";
  const bg = `border-${tone}-200 bg-${tone}-50/70 text-${tone}-950`;
  const badge = `bg-${tone}-50 text-${tone}-700 ring-${tone}-200`;
  const title = safe ? "Ngày nghỉ đang an toàn" : "Ngày nghỉ đang vi phạm mốc báo trước";
  const timing = safe
    ? `Ngày này nằm trong <strong>vùng an toàn</strong>. Mốc chậm nhất: <strong>${formatDateVN(data.deadline)}</strong>.`
    : `Mốc chậm nhất: <strong>${formatDateVN(data.deadline)}</strong>. Mốc đã chọn trễ <strong>${late} ngày</strong>.`;
  const suggestion = !safe && safeDate ? `<div class="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div class="text-xs font-bold uppercase tracking-wide text-emerald-700">Gợi ý không vi phạm</div><div class="mt-1 text-sm font-bold text-emerald-950">Ngày an toàn gần nhất: ${formatDateVN(safeDate)}</div></div><button type="button" data-use-safe-date="${toISODate(safeDate)}" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Chọn ngày này</button></div>` : "";

  result.innerHTML = `
    <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Kết quả dự kiến</p><h2 class="mt-2 text-2xl font-bold tracking-tight">${title}</h2></div><span class="rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${badge}">${safe ? "An toàn · 0 điểm" : `Dự kiến -${data.deduction} điểm`}</span></div>
    <div class="mt-7 rounded-3xl border border-slate-100 bg-slate-50/70 p-6"><div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Điểm sau dự kiến</div><div class="mt-1 flex items-baseline gap-1"><strong class="text-4xl font-extrabold text-${tone}-600">${data.projectedPoints}</strong><span class="text-sm font-semibold text-slate-400">/100</span></div><div class="mt-1 text-xs text-slate-500">${data.currentPoints} → ${data.projectedPoints} điểm</div></div>
    <div class="mt-5 grid grid-cols-3 gap-2"><div class="rounded-2xl border border-slate-200 p-3"><span class="text-[11px] uppercase text-slate-400">Mốc tính</span><div class="mt-1 text-sm font-bold">${formatDateVN(request)}</div></div><div class="rounded-2xl border border-slate-200 p-3"><span class="text-[11px] uppercase text-slate-400">Ngày nghỉ</span><div class="mt-1 text-sm font-bold">${formatDateVN(start)}</div></div><div class="rounded-2xl border border-slate-200 p-3"><span class="text-[11px] uppercase text-slate-400">Báo trước</span><div class="mt-1 text-sm font-bold">${notice}</div></div></div>
    <div class="mt-5 rounded-2xl border px-4 py-4 text-sm leading-6 ${bg}">${timing}</div>${suggestion}
    <div class="mt-5 rounded-2xl border border-slate-200 p-4"><div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Quy tắc áp dụng</div><div class="mt-1 text-sm font-bold">${data.rule.noticeLabel}</div><p class="mt-1 text-xs leading-5 text-slate-500">${data.rule.label}. ${data.reason}</p></div>`;
}

function chip(label, value, tone) {
  const cls = { blue: "border-blue-100 bg-blue-50 text-blue-700", amber: "border-amber-100 bg-amber-50 text-amber-700", violet: "border-violet-100 bg-violet-50 text-violet-700", green: "border-emerald-100 bg-emerald-50 text-emerald-700", rose: "border-rose-100 bg-rose-50 text-rose-700" }[tone] || "border-slate-200 bg-slate-50 text-slate-600";
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cls}"><span class="font-medium opacity-70">${label}</span>${value}</span>`;
}

function renderCalendar(data, request, start, end) {
  if (!calendarGrid) return;
  const focus = start || request || localToday();
  if (!calendarViewDate) calendarViewDate = startOfMonth(focus);
  const month = startOfMonth(calendarViewDate), deadline = data?.valid ? data.deadline : null, actualEnd = end || start;
  calendarTitle.textContent = formatMonth(month);
  calendarMeta.innerHTML = [
    chip("Mốc tính", request ? formatDateVN(request) : "—", "blue"), chip("Hạn chót", deadline ? formatDateVN(deadline) : "—", "amber"),
    chip("Nghỉ", start ? (actualEnd && !sameDate(start, actualEnd) ? `${formatDateVN(start)} → ${formatDateVN(actualEnd)}` : formatDateVN(start)) : "—", "violet"),
    chip("An toàn", "0 điểm", "green"), chip("Cảnh báo", "-1", "amber"), chip("Vi phạm", "-2", "rose"),
  ].join("");

  const gridStart = addDays(month, -((month.getDay() + 6) % 7)), today = localToday(), cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(gridStart, i), current = d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    const deduction = current ? evaluateCandidate(d, request)?.deduction : null;
    let status = "border-transparent bg-slate-50/60 text-slate-300", label = "";
    if (current && deduction === 0) { status = "border-emerald-100 bg-emerald-50/90 hover:bg-emerald-100"; label = "An toàn"; }
    else if (current && deduction === 1) { status = "border-amber-100 bg-amber-50/90 hover:bg-amber-100"; label = "-1"; }
    else if (current && deduction >= 2) { status = "border-rose-100 bg-rose-50/90 hover:bg-rose-100"; label = "-2"; }
    else if (current) status = "border-slate-100 bg-white";

    const classes = ["relative min-h-[62px] rounded-xl border p-1.5 text-left transition sm:min-h-[82px] sm:p-2.5", status];
    if (inRange(d, start, actualEnd)) classes.push("outline outline-2 outline-offset-[-2px] outline-violet-500");
    if (sameDate(d, request)) classes.push("ring-2 ring-inset ring-blue-500");
    if (sameDate(d, deadline)) classes.push("shadow-[inset_0_0_0_2px_rgba(245,158,11,.8)]");
    if (sameDate(d, today)) classes.push("after:pointer-events-none after:absolute after:inset-1 after:rounded-lg after:border after:border-dashed after:border-slate-500/60");
    const labelClass = deduction === 0 ? "text-emerald-700" : deduction === 1 ? "text-amber-700" : "text-rose-700";
    cells.push(`<button type="button" data-calendar-date="${toISODate(d)}" class="${classes.join(" ")}" title="${formatDateVN(d)}${label ? ` · ${label}` : ""}"><div class="flex items-start justify-between"><span class="flex size-7 items-center justify-center rounded-lg text-xs font-bold ${sameDate(d, today) ? "bg-slate-900 text-white" : current ? "text-slate-800" : "text-slate-300"}">${d.getDate()}</span><span class="flex gap-1">${sameDate(d, request) ? '<i class="size-2 rounded-full bg-blue-500"></i>' : ""}${sameDate(d, deadline) ? '<i class="size-2 rounded-full bg-amber-500"></i>' : ""}${inRange(d, start, actualEnd) ? '<i class="size-2 rounded-full bg-violet-500"></i>' : ""}</span></div>${label ? `<div class="mt-2 hidden text-[9px] font-extrabold uppercase ${labelClass} sm:block">${label}</div>` : ""}</button>`);
  }
  calendarGrid.innerHTML = cells.join("");
}

function calculate() {
  const request = parseISODate(requestInput.value), start = parseISODate(startInput.value), multi = typeInput.value === "leave-multi";
  const end = multi ? parseISODate(endInput.value) : start;
  if (!request) { renderError("Vui lòng chọn mốc tính hợp lệ."); renderCalendar(null, null, start, end); return; }
  const data = evaluateAttendance({ currentPoints: pointsInput.value, type: normalizedType(), requestDate: request, startDate: start, endDate: end, noContact: noContactInput.checked });
  renderTop(pointsInput.value, request); renderResult(data, request, start); renderCalendar(data, request, start, end); saveState();
}

function selectStartDate(date) {
  const oldDuration = durationDays();
  startInput.value = toISODate(date);
  endInput.value = typeInput.value === "leave-multi" ? toISODate(addDays(date, oldDuration - 1)) : startInput.value;
  calendarViewDate = startOfMonth(date); calculate();
}

typeInput.addEventListener("change", () => { toggleEndDate(); calculate(); });
startInput.addEventListener("change", () => { if (typeInput.value === "leave-multi" && (!endInput.value || endInput.value < startInput.value)) endInput.value = startInput.value; const d = parseISODate(startInput.value); if (d) calendarViewDate = startOfMonth(d); calculate(); });
quickDateButtons.addEventListener("click", (e) => { const b = e.target.closest("button[data-offset]"); if (b) selectStartDate(addDays(parseISODate(requestInput.value) || localToday(), Number(b.dataset.offset))); });
referenceTodayButton.addEventListener("click", () => { requestInput.value = toISODate(localToday()); calculate(); });
result.addEventListener("click", (e) => { const b = e.target.closest("button[data-use-safe-date]"); if (b) selectStartDate(parseISODate(b.dataset.useSafeDate)); });
calendarGrid?.addEventListener("click", (e) => { const b = e.target.closest("button[data-calendar-date]"); if (b) selectStartDate(parseISODate(b.dataset.calendarDate)); });
calendarPrev?.addEventListener("click", () => { calendarViewDate = addMonths(calendarViewDate || startOfMonth(localToday()), -1); calculate(); });
calendarNext?.addEventListener("click", () => { calendarViewDate = addMonths(calendarViewDate || startOfMonth(localToday()), 1); calculate(); });
calendarReset?.addEventListener("click", () => { calendarViewDate = startOfMonth(parseISODate(startInput.value) || parseISODate(requestInput.value) || localToday()); calculate(); });
form.addEventListener("input", calculate);
form.addEventListener("submit", (e) => { e.preventDefault(); calculate(); });
$("#reset-btn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); const today = localToday(), safe = defaultSafeDate(today); pointsInput.value = 96; typeInput.value = "leave"; requestInput.value = toISODate(today); startInput.value = toISODate(safe); endInput.value = startInput.value; noContactInput.checked = false; calendarViewDate = startOfMonth(safe); toggleEndDate(); calculate(); });

setInitialState();
calculate();
