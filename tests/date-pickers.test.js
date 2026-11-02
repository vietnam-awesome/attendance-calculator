import test from "node:test";
import assert from "node:assert/strict";
import { initDatePickers } from "../src/date-pickers.js";

function stubInput(value = "", type = "date") {
  return { value, type };
}

function mockFlatpickr() {
  const called = [];
  const flatpickr = (field, options) => {
    const picker = {
      input: field,
      config: { ...options, minDate: options.minDate ? new Date(options.minDate) : null },
      selectedDates: [],
      altInput: { value: "", isConnected: true },
      formatDate(date, format) {
        const y = String(date.getFullYear());
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return format === "Y-m" ? `${y}-${m}`
          : format === "m/Y" ? `${m}/${y}`
          : format === "d/m/Y" ? `${d}/${m}/${y}`
          : `${y}-${m}-${d}`;
      },
      setDate(value, trigger, format) {
        const parts = value?.split("-").map(Number) || [];
        this.selectedDates = parts.length >= 2
          ? [new Date(parts[0], parts[1] - 1, parts[2] || 1)]
          : [];
        field.value = value;
        this.lastTrigger = trigger;
        this.lastFormat = format;
      },
      set(key, value) { this.config[key] = new Date(value); },
      destroy() { this.destroyed = true; },
    };
    if (options.defaultDate) picker.setDate(options.defaultDate, false, options.dateFormat);
    called.push({ field, options, picker });
    return picker;
  };
  flatpickr.l10ns = { vn: { firstDayOfWeek: 1 } };
  return { flatpickr, called };
}

const fields = () => ({
  request: stubInput("2026-11-02"),
  start: stubInput("2026-11-09"),
  end: stubInput("2026-11-09"),
  month: stubInput("2026-11", "month"),
});

const today = () => new Date(2026, 10, 2);

test("Flatpickr is optional and keeps original native date controls on CDN failure", () => {
  const inputs = fields();
  assert.equal(initDatePickers({ flatpickr: undefined, fields: inputs, handlers: {}, getToday: today }), null);
  assert.equal(inputs.start.type, "date");
  assert.equal(inputs.month.type, "month");
});

test("date and month inputs keep canonical ISO values and use Vietnamese presentation", () => {
  const { flatpickr, called } = mockFlatpickr();
  const inputs = fields();
  const result = initDatePickers({
    flatpickr,
    monthSelectPlugin: function monthSelectPlugin() { return { name: "monthSelect" }; },
    fields: inputs, handlers: {}, getToday: today,
  });
  assert.deepEqual(result.available, ["request", "start", "end", "month"]);
  assert.equal(called[0].options.locale.firstDayOfWeek, 1);
  assert.equal(called[0].options.altFormat, "d/m/Y");
  assert.equal(called[3].options.altFormat, "m/Y");
  // The original remains a native field until Flatpickr itself hides it.
  assert.equal(inputs.start.type, "date");
  assert.equal(inputs.month.type, "month");
  assert.equal(called[0].picker.altInput.value, "02/11/2026");
  assert.equal(called[1].picker.altInput.value, "09/11/2026");
  assert.equal(called[3].picker.altInput.value, "11/2026");
  assert.equal(inputs.start.value, "2026-11-09");
  assert.equal(inputs.month.value, "2026-11");
  assert.equal(called[1].options.disable[0](new Date(2026, 10, 7)), true);
  assert.equal(called[1].options.disable[0](new Date(2026, 10, 9)), false);
  result.destroy();
  assert.ok(called.every(({picker}) => picker.destroyed));
});

test("synchronization updates programmatic dates without emitting change callbacks", () => {
  const { flatpickr, called } = mockFlatpickr();
  const inputs = fields();
  const picker = initDatePickers({
    flatpickr,
    monthSelectPlugin: function monthSelectPlugin() { return {}; },
    fields: inputs, handlers: {}, getToday: today,
  });
  picker.sync({
    request: "2026-11-03", start: "2026-11-11", end: "2026-11-12",
    month: "2026-12", minStart: "2026-11-02", minEnd: "2026-11-11",
    minMonth: new Date(2026, 10, 2),
  });
  assert.equal(inputs.start.value, "2026-11-11");
  assert.equal(inputs.month.value, "2026-12");
  assert.equal(called[1].picker.altInput.value, "11/11/2026");
  assert.equal(called[3].picker.altInput.value, "12/2026");
  assert.equal(called[1].picker.config.minDate.getDate(), 2);
  assert.equal(called[2].picker.config.minDate.getDate(), 11);
  assert.ok(called.every(({picker}) => picker.lastTrigger === false));
});

test("month plugin being unavailable falls back to native month input", () => {
  const { flatpickr } = mockFlatpickr();
  const inputs = fields();
  const picker = initDatePickers({ flatpickr, fields: inputs, handlers: {}, getToday: today });
  assert.deepEqual(picker.available, ["request", "start", "end"]);
  assert.equal(inputs.month.type, "month");
});

test("library change callbacks use existing form handlers, not an independent calculator", () => {
  const { flatpickr, called } = mockFlatpickr();
  const calls = [];
  initDatePickers({
    flatpickr,
    monthSelectPlugin: function monthSelectPlugin() { return {}; },
    fields: fields(), getToday: today,
    handlers: {
      onRequest: () => calls.push("request"),
      onStart: () => calls.push("start"),
      onEnd: () => calls.push("end"),
      onMonth: () => calls.push("month"),
    },
  });
  for (const { options } of called) options.onChange();
  assert.deepEqual(calls, ["request", "start", "end", "month"]);
});

test("visible alternate field is repaired when its value goes blank but canonical input is valid", () => {
  const { flatpickr, called } = mockFlatpickr();
  const controls = fields();
  const fp = initDatePickers({
    flatpickr,
    monthSelectPlugin: function monthSelectPlugin() { return {}; },
    fields: controls, handlers: {}, getToday: today,
  });
  const visibleStart = called[1].picker.altInput;
  visibleStart.value = "";
  fp.sync({ start: "2026-11-09" });
  assert.equal(visibleStart.value, "09/11/2026");
  assert.equal(controls.start.value, "2026-11-09");
});

test("calendar styling requests compact month headings and below-positioned popup", () => {
  const { flatpickr, called } = mockFlatpickr();
  initDatePickers({
    flatpickr,
    monthSelectPlugin: function monthSelectPlugin() { return {}; },
    fields: fields(), handlers: {}, getToday: today,
  });
  assert.equal(called[0].options.position, "below left");
  assert.equal(called[0].options.shorthandCurrentMonth, true);
  assert.equal(called[3].options.position, "below right");
});
