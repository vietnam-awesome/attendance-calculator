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

const STORAGE_KEY = "attendance-calculator-v1";

function localToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function loadState() {
  const today = localToday();
  const fallback = {
    currentPoints: 96,
    type: "leave",
    requestDate: toISODate(today),
    startDate: toISODate(addDays(today, 10)),
    endDate: toISODate(addDays(today, 10)),
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
    requestDate: requestInput.value,
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
  requestInput.value = state.requestDate;
  startInput.value = state.startDate;
  endInput.value = state.endDate;
  noContactInput.checked = state.noContact;
  toggleEndDate();
}

function toggleEndDate() {
  const isLeave = typeInput.value === "leave";
  endField.hidden = !isLeave;
  endInput.required = isLeave;
  if (isLeave && !endInput.value && startInput.value) endInput.value = startInput.value;

  const base = RULES[typeInput.value];
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

function renderResult(data) {
  if (!data.valid) {
    result.className = "result-card result-error";
    result.innerHTML = `<div class="result-icon">!</div><div><h2>Chưa thể tính</h2><p>${data.error}</p></div>`;
    return;
  }

  const isSafe = data.deduction === 0;
  const levelChanged = data.projectedLevel.level > data.currentLevel.level;
  const statusClass = isSafe ? "result-safe" : "result-risk";
  const statusTitle = isSafe
    ? "Không vi phạm thời hạn chuyên cần"
    : `Có nguy cơ bị trừ ${data.deduction} điểm`;

  const thresholdNote = levelChanged
    ? `<div class="alert danger"><strong>Cảnh báo:</strong> Điểm dự kiến chuyển từ ${data.currentLevel.name} sang ${data.projectedLevel.name}.</div>`
    : `<div class="alert neutral">Sau tình huống này vẫn ở vùng <strong>${data.projectedLevel.name}</strong> (${data.projectedLevel.range}).</div>`;

  const perfectNote = data.rewardPointConditionMet
    ? "Điểm dự kiến vẫn đáp ứng điều kiện 100 điểm của tiêu chí thưởng chuyên cần (còn phụ thuộc các điều kiện khác)."
    : "Điểm dự kiến không còn ở mức 100; vì vậy không đáp ứng riêng tiêu chí ‘điểm còn lại trong kỳ bằng 100’ của thưởng chuyên cần.";

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

    <div class="metrics-grid">
      <div class="metric">
        <span>Quy tắc áp dụng</span>
        <strong>${data.rule.label}</strong>
        <small>${data.rule.noticeLabel}</small>
      </div>
      <div class="metric">
        <span>Hạn xin chậm nhất</span>
        <strong>${formatDateVN(data.deadline)}</strong>
        <small>${data.timely ? "Ngày xin đang hợp lệ" : "Ngày xin đã trễ hạn"}</small>
      </div>
      <div class="metric">
        <span>Điểm bị trừ</span>
        <strong>${data.deduction === 0 ? "0" : `-${data.deduction}`}</strong>
        <small>Áp dụng mức cao nhất cho một lần</small>
      </div>
      <div class="metric emphasized">
        <span>Điểm sau dự kiến</span>
        <strong>${data.projectedPoints}/100</strong>
        <small>${data.projectedLevel.name}</small>
      </div>
    </div>

    ${thresholdNote}
    <div class="alert neutral"><strong>Thưởng chuyên cần:</strong> ${perfectNote}</div>
  `;
}

function calculate() {
  const data = evaluateAttendance({
    currentPoints: pointsInput.value,
    type: typeInput.value,
    requestDate: parseISODate(requestInput.value),
    startDate: parseISODate(startInput.value),
    endDate: parseISODate(endInput.value || startInput.value),
    noContact: noContactInput.checked,
  });
  renderTopSummary(pointsInput.value);
  renderResult(data);
  saveState();
}

typeInput.addEventListener("change", () => {
  toggleEndDate();
  calculate();
});

startInput.addEventListener("change", () => {
  if (typeInput.value === "leave" && (!endInput.value || endInput.value < startInput.value)) {
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
  const today = localToday();
  pointsInput.value = 96;
  typeInput.value = "leave";
  requestInput.value = toISODate(today);
  startInput.value = toISODate(addDays(today, 10));
  endInput.value = startInput.value;
  noContactInput.checked = false;
  toggleEndDate();
  calculate();
});

setInitialState();
calculate();
