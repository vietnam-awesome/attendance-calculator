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

function parseLocalISO(value, isMonth = false) {
  const pattern = isMonth ? /^(\\d{4})-(\\d{2})$/ : /^(\\d{4})-(\\d{2})-(\\d{2})$/;
  const match = typeof value === "string" ? value.match(pattern) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = isMonth ? 1 : Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (!validDate(parsed) || parsed.getFullYear() !== year ||
      parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;
  return parsed;
}

function selectedValue(picker, format) {
  return picker.selectedDates?.[0] ? picker.formatDate(picker.selectedDates[0], format) : "";
}

function synchronizeDate(picker, canonicalValue, format) {
  if (!picker) return;
  const value = canonicalValue || "";
  if (selectedValue(picker, format) !== value) {
    const parsed = parseLocalISO(value, format === "Y-m");
    picker.setDate(parsed || "", false);
  }

  // Flatpickr's altInput is a *different DOM input*. The underlying canonical
  // date may be valid even when the visible clone is accidentally blank.
  // Explicitly keep the visible field in sync on first load and after shortcuts.
  if (picker.altInput && picker.altInput.isConnected !== false) {
    const selected = picker.selectedDates?.[0];
    const altFormat = picker.config?.altFormat || (format === "Y-m" ? "m/Y" : "d/m/Y");
    const readable = selected ? picker.formatDate(selected, altFormat) : "";
    if (picker.altInput.value !== readable) picker.altInput.value = readable;
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
    shorthandCurrentMonth: true,
    position: "below left",
    static: false,
    onReady: (_, __, fp) => {
      fp.altInput?.classList.add("app-date-picker");
      fp.altInput?.setAttribute("aria-label", "Chọn ngày (ngày/tháng/năm)");
      fp.altInput?.setAttribute("autocomplete", "off");
    },
  };
  const configs = {
    request: { onChange: () => handlers.onRequest?.() },
    start: {
      minDate: getToday(),
      disable: [(date) => !isLeaveCandidateDay(date)],
      onChange: () => handlers.onStart?.(),
    },
    end: {
      minDate: getToday(),
      onChange: () => handlers.onEnd?.(),
    },
  };

  for (const [key, settings] of Object.entries(configs)) {
    const element = fields[key];
    if (!element) continue;
    const currentValue = element.value;
    const originalType = element.type;
    try {
      // Preserve original native date value. Flatpickr handles type="date"
      // natively and hides the original only *after* it has read the ISO date.
      const picker = flatpickr(element, {
        ...common, ...settings,
        defaultDate: parseLocalISO(currentValue) || undefined,
      });
      if (!picker || typeof picker.setDate !== "function") {
        element.type = originalType;
        continue;
      }
      pickers[key] = picker;
      synchronizeDate(picker, currentValue, "Y-m-d");
      if (currentValue && (!picker.selectedDates?.length || !element.value)) {
        throw new Error("Flatpickr date initialization did not preserve the selected date");
      }
    } catch {
      // Restore the exact pre-library control if the plugin initialized
      // partially or discarded a valid initial value.
      try { element._flatpickr?.destroy?.(); } catch { /* best-effort */ }
      delete pickers[key];
      element.type = originalType;
      element.value = currentValue;
    }
  }

  if (fields.month && typeof monthSelectPlugin === "function") {
    const element = fields.month;
    const currentValue = element.value;
    const originalType = element.type;
    try {
      const picker = flatpickr(element, {
        locale,
        dateFormat: "Y-m",
        altInput: true,
        altFormat: "m/Y",
        disableMobile: true,
        allowInput: false,
        position: "below right",
        shorthandCurrentMonth: true,
        minDate: new Date(getToday().getFullYear(), getToday().getMonth(), 1),
        maxDate: new Date(2100, 11, 31),
        plugins: [new monthSelectPlugin({ shorthand: false, dateFormat: "Y-m", altFormat: "m/Y" })],
        defaultDate: parseLocalISO(currentValue, true) || undefined,
        onReady: (_, __, fp) => {
          fp.altInput?.classList.add("app-date-picker", "app-month-picker");
          fp.altInput?.setAttribute("aria-label", "Chọn tháng và năm");
          fp.altInput?.setAttribute("autocomplete", "off");
        },
        onChange: () => handlers.onMonth?.(),
      });
      if (!picker || typeof picker.setDate !== "function") {
        element.type = originalType;
      } else {
        pickers.month = picker;
        synchronizeDate(picker, currentValue, "Y-m");
        if (currentValue && (!picker.selectedDates?.length || !element.value)) {
          throw new Error("Flatpickr month initialization did not preserve the selected month");
        }
      }
    } catch {
      try { element._flatpickr?.destroy?.(); } catch { /* best-effort */ }
      delete pickers.month;
      element.type = originalType;
      element.value = currentValue;
    }
  }

  return {
    sync({ request, start, end, month, minStart, minEnd, minMonth } = {}) {
      if (pickers.start && minStart && iso(pickers.start.config.minDate) !== minStart) {
        pickers.start.set("minDate", parseLocalISO(minStart));
      }
      if (pickers.end && minEnd && iso(pickers.end.config.minDate) !== minEnd) {
        pickers.end.set("minDate", parseLocalISO(minEnd));
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
