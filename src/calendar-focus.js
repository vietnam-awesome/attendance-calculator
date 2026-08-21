const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = "./favicon.svg";
document.head.appendChild(favicon);

const calendarReset = document.querySelector("#calendar-reset");
const calendarGrid = document.querySelector("#calendar-grid");
const startInput = document.querySelector("#start-date");
const typeInput = document.querySelector("#event-type");
const policyHint = document.querySelector("#policy-hint");
const pointsInput = document.querySelector("#current-points");
const resetButton = document.querySelector("#reset-btn");

const DEFAULT_POINTS = 100;
const OLD_DEFAULT_POINTS = 96;
const DEFAULT_POINTS_MIGRATION_KEY = "attendance-default-points-100-v1";

const policyHints = {
  leave: {
    text: "≥ 1 tuần",
    title: "Nghỉ 1 ngày: báo trước ít nhất 1 tuần",
  },
  "leave-multi": {
    text: "Theo số ngày",
    title: "Mốc báo trước tự xác định theo tổng số ngày nghỉ",
  },
  half: {
    text: "≥ 2 ngày",
    title: "Nghỉ nửa ngày: báo trước ít nhất 2 ngày",
  },
  late: {
    text: "≥ 2 ngày",
    title: "Đi trễ: báo trước ít nhất 2 ngày",
  },
  early: {
    text: "≥ 2 ngày",
    title: "Về sớm: báo trước ít nhất 2 ngày",
  },
};

function setPoints(value) {
  if (!pointsInput) return;
  pointsInput.value = String(value);
  pointsInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function migrateDefaultPoints() {
  if (!pointsInput || localStorage.getItem(DEFAULT_POINTS_MIGRATION_KEY)) return;

  // Only migrate the previous default. Preserve any custom score the user entered.
  if (Number(pointsInput.value) === OLD_DEFAULT_POINTS) {
    setPoints(DEFAULT_POINTS);
  }

  localStorage.setItem(DEFAULT_POINTS_MIGRATION_KEY, "1");
}

function syncPolicyHint() {
  if (!policyHint || !typeInput) return;
  const hint = policyHints[typeInput.value] || {
    text: "Quy tắc",
    title: "Quy tắc áp dụng",
  };
  policyHint.textContent = hint.text;
  policyHint.title = hint.title;
  policyHint.setAttribute("aria-label", hint.title);
}

function normalizePastCells() {
  if (!calendarGrid) return;

  calendarGrid
    .querySelectorAll('button[disabled][title*="Đã qua"]')
    .forEach((day) => {
      day.style.boxShadow = "none";
      day.style.outline = "none";
      day.querySelectorAll("i").forEach((marker) => marker.remove());
    });
}

function focusSelectedDay({ scroll = false } = {}) {
  const value = startInput?.value;
  if (!value || !calendarGrid) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      normalizePastCells();

      const selected = calendarGrid.querySelector(
        `button[data-calendar-date="${CSS.escape(value)}"]`,
      );
      if (!selected) return;

      selected.focus({ preventScroll: true });
      selected.animate(
        [
          {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(139,92,246,0)",
          },
          {
            transform: "scale(1.025)",
            boxShadow: "0 0 0 5px rgba(139,92,246,.16)",
          },
          {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(139,92,246,0)",
          },
        ],
        { duration: 620, easing: "ease-out" },
      );

      if (scroll) {
        selected.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

typeInput?.addEventListener("change", () =>
  requestAnimationFrame(syncPolicyHint),
);
syncPolicyHint();
migrateDefaultPoints();

if (calendarGrid) {
  const observer = new MutationObserver(() => normalizePastCells());
  observer.observe(calendarGrid, { childList: true, subtree: true });
  normalizePastCells();
}

calendarReset?.addEventListener("click", () => focusSelectedDay());

calendarGrid?.addEventListener("click", (event) => {
  const day = event.target.closest("button[data-calendar-date]");
  if (!day || day.disabled) return;
  focusSelectedDay();
});

resetButton?.addEventListener("click", () => {
  // app.js resets first; then normalize the new default to 100.
  queueMicrotask(() => setPoints(DEFAULT_POINTS));
});
