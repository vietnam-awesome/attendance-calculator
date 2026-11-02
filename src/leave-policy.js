import { subtractMonthsClamped } from "./attendance-rules.js";

// RCVN Annual Holiday / 有給休暇使用規則 workbook:
// Chế_độ_nghỉ_hè (revised 2025-05-01), Phép_năm (effective 2021-01-01).
// These checks are separate from attendance-point penalties and never grant approval.
export const LEAVE_KINDS = Object.freeze({
  annual: "Phép năm",
  summer: "Nghỉ hè đặc biệt",
});

const DAY_MS = 86_400_000;
const DAY_LIMIT = 366;
const ELIGIBLE_ROLES = new Set(["chief", "manager"]);

function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function isWeekday(date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

function dateFromDay(day) {
  const utc = new Date(day * DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function countWeekdays(start, end) {
  if (!start || !end) return 0;
  const from = utcDay(start);
  const to = utcDay(end);
  if (to < from || to - from >= DAY_LIMIT) return 0;
  let total = 0;
  for (let day = from; day <= to; day += 1) {
    if (isWeekday(dateFromDay(day))) total += 1;
  }
  return total;
}

function inSummerWindow(date) {
  return date && date.getMonth() >= 5 && date.getMonth() <= 9;
}

function addMonthsClamped(date, months) {
  // Convert by month first to avoid overflow for 29th/30th/31st.
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

function gapHasOnlyWeekends(end, nextStart) {
  const from = utcDay(end) + 1;
  const to = utcDay(nextStart) - 1;
  if (to < from) return true;
  if (to - from >= 7) return false;
  for (let day = from; day <= to; day += 1) {
    if (isWeekday(dateFromDay(day))) return false;
  }
  return true;
}

// A configured public-holiday period connects to the requested period when they
// overlap, touch, or are separated only by a weekend. Holiday dates are user
// supplied: government-observed days can move and are not hardcoded.
export function connectsToHoliday(start, end, holidayStart, holidayEnd) {
  if (!start || !end || !holidayStart || !holidayEnd) return false;
  if (end < start || holidayEnd < holidayStart) return false;
  if (utcDay(start) <= utcDay(holidayEnd) && utcDay(holidayStart) <= utcDay(end)) {
    return true;
  }
  if (end < holidayStart) return gapHasOnlyWeekends(end, holidayStart);
  return gapHasOnlyWeekends(holidayEnd, start);
}

export function evaluateLeavePolicy({
  kind = "annual",
  requestDate,
  startDate,
  endDate,
  role = "staff",
  fullTimeDate = null,
  summerUsed = false,
  handover = false,
  attachAnnual = false,
  forceMajeure = false,
  holidayStart = null,
  holidayEnd = null,
  approved = false,
} = {}) {
  if (!LEAVE_KINDS[kind]) {
    return { valid: false, error: "Chế độ nghỉ không hợp lệ." };
  }
  if (!requestDate || !startDate || !endDate || endDate < startDate) {
    return { valid: false, error: "Ngày đăng ký hoặc khoảng nghỉ không hợp lệ." };
  }
  if ((holidayStart && !holidayEnd) || (!holidayStart && holidayEnd) ||
      (holidayStart && holidayEnd < holidayStart)) {
    return { valid: false, error: "Cần nhập đủ khoảng ngày lễ hợp lệ hoặc để trống cả hai." };
  }

  const blocking = [];
  const warnings = [];
  const information = [];
  const connectedHoliday = connectsToHoliday(
    startDate, endDate, holidayStart, holidayEnd,
  );
  const workdays = countWeekdays(startDate, endDate);
  let noticeDeadline = null;
  let eligibleFrom = null;

  if (kind === "annual") {
    information.push("Phép năm có thể kết hợp ngày lễ nếu xin đúng quy định và được quản lý duyệt (sheet Phép_năm, mục 9a–c).");
    information.push("Phép năm chưa dùng có thể dùng đến 31/03 năm sau; việc kết hợp phép năm cũ và mới vào dịp Tết cần phê duyệt (mục 6, 9–10).");
    if (connectedHoliday) {
      information.push("Nghỉ phép năm nối ngày lễ không bị cấm tuyệt đối; vẫn phải được duyệt.");
    }
  } else {
    // Separate summer-leave notice from ordinary attendance notification rules.
    noticeDeadline = subtractMonthsClamped(
      startDate, ELIGIBLE_ROLES.has(role) ? 2 : 1,
    );
    if (!inSummerWindow(startDate) || !inSummerWindow(endDate) ||
        startDate.getFullYear() !== endDate.getFullYear()) {
      blocking.push("Nghỉ hè đặc biệt chỉ được sử dụng trong khoảng 01/06–31/10 cùng năm.");
    }
    if (workdays < 1 || workdays > 5) {
      blocking.push("Nghỉ hè đặc biệt chỉ cho phép tối đa 5 ngày làm việc liên tiếp (ước tính theo thứ Hai–thứ Sáu).");
    }
    if (summerUsed) {
      blocking.push("Chế độ nghỉ hè đặc biệt chỉ được sử dụng một lần mỗi năm.");
    }
    if (handover) {
      blocking.push("Nhân viên đang trong giai đoạn bàn giao công việc không được sử dụng chế độ nghỉ hè.");
    }
    if (fullTimeDate) {
      eligibleFrom = addMonthsClamped(fullTimeDate, 6);
      if (startDate < eligibleFrom) {
        blocking.push("Chưa đủ 6 tháng kể từ ngày trở thành nhân viên chính thức tại thời điểm bắt đầu nghỉ.");
      }
    } else {
      warnings.push("Chưa nhập ngày trở thành nhân viên chính thức nên chưa xác nhận được điều kiện 6 tháng.");
    }
    if (requestDate > noticeDeadline) {
      blocking.push("Đăng ký nghỉ hè chưa đủ thời gian báo trước theo vai trò: nhân viên/Leader/BSE/Section Chief là 1 tháng, Chief/Manager là 2 tháng.");
    }
    if (attachAnnual) {
      if (forceMajeure) {
        warnings.push("Nối phép năm với nghỉ hè chỉ được xem xét khi có lý do bất khả kháng; cần cấp quản lý chấp thuận riêng.");
      } else {
        blocking.push("Về nguyên tắc không chấp nhận dùng thêm phép năm để nghỉ nối tiếp nghỉ hè (trừ bất khả kháng).");
      }
    }
    if (connectedHoliday) {
      blocking.push("Về cơ bản không chấp nhận nghỉ hè đặc biệt tiếp nối kỳ nghỉ lễ Nhà nước, kể cả khi chỉ cách nhau cuối tuần.");
    }
    information.push("Cần cấp Chief trở lên phê duyệt; dự án trùng lịch nhân sự hoặc nhu cầu công việc có thể khiến đơn bị từ chối.");
    information.push("Nếu tự ý kết hợp hoặc vi phạm quy định, ngày đã nghỉ có thể bị chuyển sang phép năm còn lại hoặc nghỉ không lương.");
  }

  if (!approved) warnings.push("Chưa xác nhận được sự phê duyệt của cấp quản lý.");
  return {
    valid: true,
    kind,
    status: blocking.length ? "restricted" : warnings.length ? "review" : "approved",
    blocking,
    warnings,
    information,
    connectedHoliday,
    workdays,
    noticeDeadline,
    eligibleFrom,
    requiresApproval: true,
  };
}
