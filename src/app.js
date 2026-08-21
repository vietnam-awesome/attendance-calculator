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
const todayLabel = $("#today-label");

const STORAGE_KEY = "attendance-calculator-v2";
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
  const state = {
    currentPoints: Number(pointsInput.value),
    type: typeInput.value,
    startDate: startInput.value,
    endDate: endInput.value,
    noContact: noContactInput.checked,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setInitialState() {
  const state = loadState();
  pointsInput.value = state.currentPoints;
  typeInput.value = state.type;
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
    policyHint.textContent = "Tự xác định theo số ngày nghỉ";
    return;
  }
  const base = RULES[normalizedType()];
  policyHint.textContent = base?.shortLabel || "";
}

function renderTopSummary(points) {
  const safePoints = Math.max(0, Math.min(100, Number(points) || 0));
  const level = getViolationLevel(safePoints);
  const period = getEvaluationPeriod(localToday());

  periodEl.textContent = `${period.label}: ${formatDateVN(period.start)} – ${formatDateVN(period.end)}`;
  pointsBadge.textContent = `${safePoints}/100`;
  pointsBar.style.width = `${safePoints}%`;
  currentLevelEl.textContent = level.name;
  currentLevelEl.dataset.level = String(level.level);
}

function renderResult(data, requestDate, startDate) {
  if (!data.valid) {
    result.className = "result-card result-error";
    result.innerHTML = `<div class="result-icon">!</div><div><h2>Chưa thể tính</h2><p>${data.error}</p></div>`;
    return;
  }

  const isSafe = data.deduction === 0;
  const levelChanged = data.projectedLevel.level > data.currentLevel.level;
  const statusClass = isSafe ? "result-safe" : "result-risk";
  const noticeDays = calendarDaysBetween(startDate, requestDate);
  const lateBy = Math.max(0, calendarDaysBetween(requestDate, data.deadline));

  const statusTitle = isSafe
    ? "Không bị trừ điểm"
    : `Tính từ hôm nay: dự kiến -${data.deduction} điểm`;

  const scenarioText = noContactInput.checked
    ? `Ngày dự định: ${formatDateVN(startDate)} · mô phỏng không báo trước`
    : `Hôm nay ${formatDateVN(requestDate)} → nghỉ ${formatDateVN(startDate)} → báo trước ${Math.max(0, noticeDays)} ngày`;

  const timingMessage = data.timely
    ? `Theo mốc hiện tại, bạn vẫn còn trong hạn. Hạn chót là ${formatDateVN(data.deadline)}.`
    : `Mốc báo trước chậm nhất là ${formatDateVN(data.deadline)}. Tính từ hôm nay thì đã trễ ${lateBy} ngày.`;

  const thresholdNote = levelChanged
    ? `<div class="alert danger"><strong>Cảnh báo:</strong> Điểm dự kiến chuyển từ ${data.currentLevel.name} sang ${data.projectedLevel.name}.</div>`
    : `<div class="alert neutral">Sau tình huống này vẫn ở vùng <strong>${data.projectedLevel.name}</strong> (${data.projectedLevel.range}).</div>`;

  result.className = `result-card ${statusClass}`;
  result.innerHTML = `
    <div class="result-heading">
      <div class="result-icon">${isSafe ? "✓" : "!"}</div>
      <div>
        <p class="eyebrow">Kết quả dự kiến</p>
        <h2>${statusTitle}</h2>
        <p>${data.reason}</p>
      </div>
    </div>

    <div class="scenario-line">${scenarioText}</div>
    <div class="timing-box ${isSafe ? "safe" : "risk"}">${timingMessage}</div>

    <div class="metrics-grid simplified-metrics">
      <div class="metric">
        <span>Quy tắc</span>
        <strong>${data.rule.noticeLabel}</strong>
        <small>${data.rule.label}</small>
      </div>
      <div class="metric emphasized">
        <span>Điểm sau dự kiến</span>
        <strong>${data.projectedPoints}/100</strong>
        <small>${data.currentPoints}/100 → ${data.projectedPoints}/100</small>
      </div>
    </div>

    ${thresholdNote}
  `;
}

function calculate() {
  const today = localToday();
  const startDate = parseISODate(startInput.value);
  const isMultiDay = typeInput.value === "leave-multi";
  const endDate = isMultiDay
    ? parseISODate(endInput.value)
    : startDate;

  const data = evaluateAttendance({
    currentPoints: pointsInput.value,
    type: normalizedType(),
    requestDate: today,
    startDate,
    endDate,
    noContact: noContactInput.checked,
  });

  todayLabel.textContent = formatDateVN(today);
  renderTopSummary(pointsInput.value);
  renderResult(data, today, startDate);
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

form.addEventListener("input", calculate);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

$("#reset-btn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  const tomorrow = addDays(localToday(), 1);
  pointsInput.value = 96;
  typeInput.value = "leave";
  startInput.value = toISODate(tomorrow);
  endInput.value = startInput.value;
  noContactInput.checked = false;
  toggleEndDate();
  calculate();
});

setInitialState();
calculate();
