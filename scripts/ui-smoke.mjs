import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const URL = "http://127.0.0.1:8765/";
await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.USE_SYSTEM_CHROME ? { channel: "chrome" } : {}) });
const failures = [];
try {
  for (const viewport of [
    { width: 1440, height: 900, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => failures.push(`${viewport.name}: ${error.message}`));
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(
      () => document.querySelector("#start-date")?._flatpickr?.altInput,
      { timeout: 15000 },
    );
    await page.waitForTimeout(1200);
    const dateValues = await page.evaluate(() => {
      return ["request-date", "start-date"].map((id) => {
        const input = document.getElementById(id);
        return {
          id, value: input.value,
          visible: input._flatpickr?.altInput?.value || "",
          picker: Boolean(input._flatpickr),
        };
      });
    });
    await page.screenshot({ path: `screenshots/${viewport.name}-initial.png`, fullPage: true });
    for (const field of dateValues) {
      assert.ok(field.picker, `${viewport.name} ${field.id} should use Flatpickr`);
      assert.match(field.value, /^\d{4}-\d{2}-\d{2}$/, `${field.id} ISO date`);
      assert.match(field.visible, /^\d{2}\/\d{2}\/\d{4}$/, `${field.id} visible date`);
    }
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    assert.ok(width.scroll <= width.viewport + 4, `${viewport.name} horizontal overflow: ${JSON.stringify(width)}`);
    await page.screenshot({ path: `screenshots/${viewport.name}.png`, fullPage: true });
    const input = page.locator("#request-date + input");
    await input.click();
    await page.locator(".flatpickr-calendar.open").first().waitFor();
    const bounds = await page.locator(".flatpickr-calendar.open").first().boundingBox();
    assert.ok(bounds && bounds.x >= -4 && bounds.x + bounds.width <= viewport.width + 4,
      `${viewport.name} popup fits viewport: ${JSON.stringify(bounds)}`);
    const headerVisible = await page.locator(".flatpickr-calendar.open .flatpickr-current-month").first().evaluate((element) => {
      const box = element.getBoundingClientRect();
      const year = element.querySelector(".cur-year");
      const yearBox = year?.getBoundingClientRect();
      return {
        container: { x: box.x, y: box.y, width: box.width, height: box.height },
        year: year?.value,
        yearWithin: Boolean(yearBox && yearBox.top >= box.top - 5 && yearBox.bottom <= box.bottom + 6),
      };
    });
    assert.ok(headerVisible.year && headerVisible.yearWithin,
      `${viewport.name} month/year header must not be clipped: ${JSON.stringify(headerVisible)}`);
    await page.screenshot({ path: `screenshots/${viewport.name}-picker-open.png`, fullPage: true });
    await page.close();
  }
  if (failures.length) throw new Error(failures.join("; "));
} finally {
  await browser.close();
}
