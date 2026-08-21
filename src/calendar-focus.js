const calendarReset = document.querySelector("#calendar-reset");
const calendarGrid = document.querySelector("#calendar-grid");
const startInput = document.querySelector("#start-date");

function focusSelectedDay({ scroll = false } = {}) {
  const value = startInput?.value;
  if (!value || !calendarGrid) return;

  // app.js re-renders the grid when the selected month/date changes.
  // Wait two frames so we always target the freshly rendered cell.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const selected = calendarGrid.querySelector(
        `button[data-calendar-date="${CSS.escape(value)}"]`,
      );
      if (!selected) return;

      selected.focus({ preventScroll: true });
      selected.animate(
        [
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(139,92,246,0)" },
          { transform: "scale(1.025)", boxShadow: "0 0 0 5px rgba(139,92,246,.16)" },
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(139,92,246,0)" },
        ],
        { duration: 620, easing: "ease-out" },
      );

      if (scroll) {
        selected.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

calendarReset?.addEventListener("click", () => focusSelectedDay());

calendarGrid?.addEventListener("click", (event) => {
  const day = event.target.closest("button[data-calendar-date]");
  if (!day || day.disabled) return;

  // Even when clicking the already-selected day, give visible feedback.
  focusSelectedDay();
});
