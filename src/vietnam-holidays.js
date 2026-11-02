// Public Vietnamese holidays, independent of any employer-specific leave policy.
// Legal basis: Labor Code 2019, Article 112; Resolution 28/2026/QH16
// (Vietnam Culture Day, effective July 2026).
// Government-sector schedules are reference only. Employers can choose their own
// Lunar New Year / secondary National Day dates and working-day swaps.
const SOURCES = Object.freeze({
  law: "https://vanban.org/van-ban/bo-luat-lao-dong-2019-45-2019-qh14/dieu-112",
  culture: "https://xaydungchinhsach.chinhphu.vn/ngay-24-11-hang-nam-la-ngay-van-hoa-viet-nam-nguoi-lao-dong-duoc-nghi-huong-nguyen-luong-119260113152642414.htm",
  schedule2026: "https://baochinhphu.vn/bo-noi-vu-thong-bao-lich-nghi-tet-am-lich-va-nghi-le-quoc-khanh-nam-2026-102251017095507785.htm",
  schedule2027: "https://xaydungchinhsach.chinhphu.vn/de-xuat-2-phuong-an-nghi-tet-nguyen-dan-2027-tet-dinh-mui-11926080513033257.htm",
});
export const VIETNAM_HOLIDAY_SOURCES = SOURCES;

// Gregorian dates only; no guessed conversion for lunar holidays in unknown years.
const VERIFIED_YEARS = Object.freeze({
  2026: {
    hungKings: "2026-04-26", // 10/3 lunar, Sunday
    tet: ["2026-02-14", "2026-02-22"], // full public-sector break (incl. weekends)
    nationalAdjacent: "2026-09-01",
  },
  2027: {
    hungKings: "2027-04-16", // 10/3 lunar, Friday
    tet: ["2027-02-04", "2027-02-10"], // 5 legal + 2 compensatory days, public-sector
    nationalAdjacent: "2027-09-03",
  },
});

function event(id, name, start, end = start, kind = "statutory", note = "") {
  return { id, name, start, end, kind, note };
}

export function getVietnamHolidays(year) {
  if (!Number.isInteger(year) || year < 2021 || year > 2100) return [];
  const fixed = [
    event("new-year", "Tết Dương lịch", `${year}-01-01`),
    event("reunification", "Ngày Chiến thắng 30/4", `${year}-04-30`),
    event("labor", "Quốc tế Lao động", `${year}-05-01`),
    event("national-day", "Quốc khánh 2/9", `${year}-09-02`, undefined, "statutory", "Còn 1 ngày liền kề do cơ quan sử dụng lao động bố trí."),
  ];
  if (year >= 2026) {
    fixed.push(event("culture", "Ngày Văn hóa Việt Nam", `${year}-11-24`));
  }
  const verified = VERIFIED_YEARS[year];
  if (verified) {
    fixed.push(
      event("hung-kings", "Giỗ Tổ Hùng Vương (10/3 âm lịch)", verified.hungKings),
      event("tet-government", "Tết Nguyên đán (lịch khối nhà nước)", verified.tet[0], verified.tet[1], "reference",
        "Gồm ngày nghỉ cuối tuần/nghỉ bù. Doanh nghiệp có thể chọn ngày khác; không mặc nhiên áp dụng."),
      event("national-adjacent-government", "Quốc khánh — ngày liền kề (khối nhà nước)", verified.nationalAdjacent,
        undefined, "reference", "Doanh nghiệp có thể chọn ngày trước hoặc sau 2/9."),
    );
  }
  if (year === 2026) {
    fixed.push(
      event("hung-kings-compensation", "Nghỉ bù Giỗ Tổ (nếu nghỉ Chủ nhật)", "2026-04-27", undefined, "reference",
        "Nghỉ bù khi ngày nghỉ hằng tuần trùng Giỗ Tổ Hùng Vương."),
      event("national-swap-government", "Nghỉ hoán đổi Quốc khánh (khối nhà nước)", "2026-08-31",
        undefined, "reference", "Khối nhà nước làm bù vào thứ Bảy 22/08/2026; doanh nghiệp có thể khác."),
    );
  }
  return fixed.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export function getHolidaysOnDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return [];
  const iso = localISO(date);
  return getVietnamHolidays(date.getFullYear())
    .filter((item) => item.start <= iso && item.end >= iso)
    .sort((a, b) => (a.kind === "statutory" ? -1 : 1) - (b.kind === "statutory" ? -1 : 1));
}

export function localISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getUpcomingVietnamHolidays(fromDate, count = 6) {
  if (!(fromDate instanceof Date) || Number.isNaN(fromDate.getTime()) || count <= 0) return [];
  const today = localISO(fromDate);
  const year = fromDate.getFullYear();
  return [...getVietnamHolidays(year), ...getVietnamHolidays(year + 1)]
    .filter((holiday) => holiday.end >= today)
    .slice(0, count);
}

export function isVerifiedLunarHolidayYear(year) {
  return Boolean(VERIFIED_YEARS[year]);
}
