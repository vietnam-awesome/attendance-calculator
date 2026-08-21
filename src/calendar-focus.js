const calendarReset = document.querySelector("#calendar-reset");
const calendarGrid = document.querySelector("#calendar-grid");
const startInput = document.querySelector("#start-date");
const typeInput = document.querySelector("#event-type");
const policyHint = document.querySelector("#policy-hint");

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
      // Past dates always win visually over deadline / selected-date markers.
      // Keep the deadline in the summary chip, but do not highlight a past cell.
      day.style.boxShadow = "none";
      day.style.outline = "none";
      day.querySelectorAll("i").forEach((marker) => marker.remove());
    });
}

function focusSelectedDay({ scroll = false } = {}) {
  const value = startInput?.value;
  if (!value || !calendarGrid) return;

  // app.js re-renders the grid when the selected month/date changes.
  // Wait two frames so we always target the freshly rendered cell.
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

if (calendarGrid) {
  const observer = new MutationObserver(() => normalizePastCells());
  observer.observe(calendarGrid, { childList: true, subtree: true });
  normalizePastCells();
}

calendarReset?.addEventListener("click", () => focusSelectedDay());

calendarGrid?.addEventListener("click", (event) => {
  const day = event.target.closest("button[data-calendar-date]");
  if (!day || day.disabled) return;

  // Even when clicking the already-selected day, give visible feedback.
  focusSelectedDay();
});
