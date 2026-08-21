export const RULES = Object.freeze({
  late: {
    key: "late",
    label: "Đi trễ",
    notice: { type: "days", value: 2 },
    shortLabel: "Báo trước ít nhất 2 ngày",
    absence: false,
  },
  early: {
    key: "early",
    label: "Về sớm",
    notice: { type: "days", value: 2 },
    shortLabel: "Báo trước ít nhất 2 ngày",
    absence: false,
  },
  half: {
    key: "half",
    label: "Nghỉ 1/2 ngày",
    notice: { type: "days", value: 2 },
    shortLabel: "Báo trước ít nhất 2 ngày",
    absence: true,
  },
  leave: {
    key: "leave",
    label: "Nghỉ từ 1 ngày trở lên",
    notice: null,
    shortLabel: "Tự xác định theo độ dài kỳ nghỉ",
    absence: true,
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISODate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateVN(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function utcDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function inclusiveDays(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return Math.round(utcDayNumber(endDate) - utcDayNumber(startDate)) + 1;
}

export function subtractDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - days);
  return result;
}

export function subtractMonthsClamped(date, months) {
  const originalDay = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setMonth(result.getMonth() - months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function classifyLeaveSpan(startDate, endDate) {
  const days = inclusiveDays(startDate, endDate);
  if (days <= 0) return null;
  if (days >= 30) {
    return {
      bucket: "month-plus",
      label: "Nghỉ từ 1 tháng trở lên",
      notice: { type: "months", value: 2 },
      noticeLabel: "Báo trước ít nhất 2 tháng",
      days,
    };
  }
  if (days >= 7) {
    return {
      bucket: "week-plus",
      label: "Nghỉ từ 1 tuần trở lên",
      notice: { type: "months", value: 1 },
      noticeLabel: "Báo trước ít nhất 1 tháng",
      days,
    };
  }
  return {
    bucket: "day-plus",
    label: days === 1 ? "Nghỉ 1 ngày" : `Nghỉ ${days} ngày`,
    notice: { type: "days", value: 7 },
    noticeLabel: "Báo trước ít nhất 1 tuần",
    days,
  };
}

export function getNoticeRule(type, startDate, endDate) {
  const base = RULES[type];
  if (!base) return null;
  if (type !== "leave") {
    return {
      type,
      label: base.label,
      notice: base.notice,
      noticeLabel: base.shortLabel,
      absenceDays: type === "half" ? 0.5 : 0,
      isAbsence: base.absence,
    };
  }

  const span = classifyLeaveSpan(startDate, endDate);
  if (!span) return null;
  return {
    type,
    label: span.label,
    notice: span.notice,
    noticeLabel: span.noticeLabel,
    absenceDays: span.days,
    isAbsence: true,
    bucket: span.bucket,
  };
}

export function getNoticeDeadline(startDate, notice) {
  if (!startDate || !notice) return null;
  if (notice.type === "days") return subtractDays(startDate, notice.value);
  if (notice.type === "months") return subtractMonthsClamped(startDate, notice.value);
  return null;
}

export function getViolationLevel(points) {
  if (points >= 89) {
    return {
      level: 0,
      name: "Chưa hình thành mức vi phạm",
      range: "89–100",
      description: "Chưa chạm Mức 1–5",
    };
  }
  if (points >= 77) {
    return {
      level: 1,
      name: "Mức 1",
      range: "77–88",
      description: "Thuộc vùng điểm Mức 1",
    };
  }
  if (points >= 65) {
    return {
      level: 2,
      name: "Mức 2",
      range: "65–76",
      description: "Thuộc vùng điểm Mức 2",
    };
  }
  if (points >= 53) {
    return {
      level: 3,
      name: "Mức 3",
      range: "53–64",
      description: "Thuộc vùng điểm Mức 3",
    };
  }
  if (points >= 41) {
    return {
      level: 4,
      name: "Mức 4",
      range: "41–52",
      description: "Thuộc vùng điểm Mức 4",
    };
  }
  return {
    level: 5,
    name: "Mức 5",
    range: "≤ 40",
    description: "Thuộc vùng điểm Mức 5",
  };
}

export function getEvaluationPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 5 && month <= 10) {
    return {
      start: new Date(year, 5, 1),
      end: new Date(year, 10, 30),
      label: "Kỳ sau",
    };
  }
  if (month === 11) {
    return {
      start: new Date(year, 11, 1),
      end: new Date(year + 1, 4, 31),
      label: "Kỳ đầu",
    };
  }
  return {
    start: new Date(year - 1, 11, 1),
    end: new Date(year, 4, 31),
    label: "Kỳ đầu",
  };
}

export function evaluateAttendance({
  currentPoints,
  type,
  requestDate,
  startDate,
  endDate,
  noContact = false,
}) {
  const points = Number(currentPoints);
  if (!Number.isFinite(points) || points < 0 || points > 100) {
    return { valid: false, error: "Điểm hiện tại phải nằm trong khoảng 0–100." };
  }
  if (!requestDate || !startDate) {
    return { valid: false, error: "Vui lòng chọn ngày bắt đầu." };
  }
  if (type === "leave" && (!endDate || endDate < startDate)) {
    return { valid: false, error: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." };
  }

  const rule = getNoticeRule(type, startDate, endDate || startDate);
  if (!rule) return { valid: false, error: "Không xác định được quy tắc áp dụng." };

  const deadline = getNoticeDeadline(startDate, rule.notice);
  const timely = !noContact && requestDate <= deadline;
  let deduction = 0;
  let reason = "Đủ thời gian báo trước theo quy tắc đang dùng.";

  if (!timely) {
    const sameDayOrLater = requestDate >= startDate;
    const longAbsenceViolation = rule.isAbsence && rule.absenceDays > 1;

    if (noContact) {
      deduction = 2;
      reason = "Không báo trước: dự kiến trừ 2 điểm.";
    } else if (sameDayOrLater) {
      deduction = 2;
      reason = "Đến ngày phát sinh hoặc sau đó mới báo: dự kiến trừ 2 điểm.";
    } else if (longAbsenceViolation) {
      deduction = 2;
      reason = "Nghỉ trên 1 ngày nhưng không đủ thời gian báo trước: dự kiến trừ 2 điểm.";
    } else {
      deduction = 1;
      reason = "Có báo trước nhưng chưa đủ thời gian: dự kiến trừ 1 điểm.";
    }
  }

  const projectedPoints = Math.max(0, points - deduction);
  const currentLevel = getViolationLevel(points);
  const projectedLevel = getViolationLevel(projectedPoints);

  return {
    valid: true,
    rule,
    deadline,
    timely,
    deduction,
    reason,
    currentPoints: points,
    projectedPoints,
    currentLevel,
    projectedLevel,
    rewardPointConditionMet: projectedPoints === 100,
  };
}
