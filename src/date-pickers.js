// Progressive Flatpickr enhancement for a static no-build website.
// Keep native date/month inputs working whenever the CDN or plugin is unavailable.
import { isLeaveCandidateDay } from "./calendar-days.js";

function validDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function iso(date) {
  return validDate(date)
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
}

function selectedValue(picker, format) {
  return picker.selectedDates?.[0] ? picker.formatDate(picker.selectedDates[0], format) : "";
}

function synchronizeDate(picker, canonicalValue, format) {
  if (!picker) return;
  const value = canonicalValue || "";
  if (selectedValue(picker, format) !== value) {
    picker.setDate(value, false, format);
  }
}

export function initDatePickers({
  flatpickr,
  monthSelectPlugin,
  fields,
  handlers,
  getToday,
} = {}) {
  if (typeof flatpickr !== "function" || !fields || !handlers ||
      typeof getToday !== "function") return null;

  const pickers = {};
  const locale = flatpickr.l10ns?.vn || flatpickr.l10ns?.default || "default";
  const common = {
    locale,
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    disableMobile: true,
    allowInput: false,
    monthSelectorType: "dropdown",
    position: "auto",
    static: false,
    onReady: (_, __, fp) => {
      fp.altInput?.classList.add("app-date-picker");
      fp.altInput?.setAttribute("aria-label", "Chọn ngày (ngày/tháng/năm)");
    },
  };
  const configs = {
    request: { onChange: () => handlers.onRequest?.() },
    start: {
      minDate: iso(getToday()),
      disable: [(date) => !isLeaveCandidateDay(date)],
      onChange: () => handlers.onStart?.(),
    },
    end: {
      minDate: iso(getToday()),
      onChange: () => handlers.onEnd?.(),
    },
  };

  for (const [key, settings] of Object.entries(configs)) {
    const element = fields[key];
    if (!element) continue;
    const currentValue = element.value;
    try {
      // Flatpickr uses a text input internally. Convert only when the library
      // is actually available so users retain native picker functionality on
      // failed CDN connections.
      const originalType = element.type;
      element.type = "text";
      const picker = flatpickr(element, { ...common, ...settings, defaultDate: currentValue || undefined });
      if (!picker || typeof picker.setDate !== "function") {
        element.type = originalType;
        continue;
      }
      pickers[key] = picker;
    } catch {
      // The original controls remain usable; never crash the entire planner
      // just because an optional date picker fails to initialize.
      if (!element._flatpickr) element.type = "date";
    }
  }

  if (fields.month && typeof monthSelectPlugin === "function") {
    const element = fields.month;
    const currentValue = element.value;
    try {
      const originalType = element.type;
      element.type = "text";
      const picker = flatpickr(element, {
        locale,
        dateFormat: "Y-m",
        altInput: true,
        altFormat: "m/Y",
        disableMobile: true,
        allowInput: false,
        position: "auto right",
        minDate: new Date(getToday().getFullYear(), getToday().getMonth(), 1),
        maxDate: new Date(2100, 11, 31),
        plugins: [new monthSelectPlugin({ shorthand: false, dateFormat: "Y-m", altFormat: "m/Y" })],
        defaultDate: currentValue || undefined,
        onReady: (_, __, fp) => {
          fp.altInput?.classList.add("app-date-picker");
          fp.altInput?.setAttribute("aria-label", "Chọn tháng và năm");
        },
        onChange: () => handlers.onMonth?.(),
      });
      if (!picker || typeof picker.setDate !== "function") {
        element.type = originalType;
      } else {
        pickers.month = picker;
      }
    } catch {
      if (!element._flatpickr) element.type = "month";
    }
  }

  return {
    sync({ request, start, end, month, minStart, minEnd, minMonth } = {}) {
      if (pickers.start && minStart && iso(pickers.start.config.minDate) !== minStart) {
        pickers.start.set("minDate", minStart);
      }
      if (pickers.end && minEnd && iso(pickers.end.config.minDate) !== minEnd) {
        pickers.end.set("minDate", minEnd);
      }
      if (pickers.month && minMonth) {
        const min = new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
        if (pickers.month.config.minDate?.getTime() !== min.getTime()) {
          pickers.month.set("minDate", min);
        }
      }
      synchronizeDate(pickers.request, request, "Y-m-d");
      synchronizeDate(pickers.start, start, "Y-m-d");
      synchronizeDate(pickers.end, end, "Y-m-d");
      synchronizeDate(pickers.month, month, "Y-m");
    },
    destroy() {
      for (const picker of Object.values(pickers)) picker.destroy();
    },
    available: Object.keys(pickers),
  };
}
