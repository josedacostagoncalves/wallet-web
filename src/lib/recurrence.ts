export type RecurrenceType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "interval_days"
  | "interval_months"
  | "monthly_nth_work_day"
  | "monthly_nth_last_work_day";

/** Work days = Mon–Fri. Returns ISO date strings (YYYY-MM-DD) in order. */
function getWorkDaysInMonth(year: number, month: number): string[] {
  const out: string[] = [];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    const dow = date.getUTCDay(); // 0 Sun .. 6 Sat
    if (dow >= 1 && dow <= 5) out.push(date.toISOString().slice(0, 10));
  }
  return out;
}

/** 1-based index. e.g. 3 = 3rd work day of month. */
function nthWorkDayOfMonth(
  year: number,
  month: number,
  n: number
): string | null {
  const days = getWorkDaysInMonth(year, month);
  return n >= 1 && n <= days.length ? days[n - 1]! : null;
}

/** 1-based from end. e.g. 3 = 3rd last work day of month. */
function nthLastWorkDayOfMonth(
  year: number,
  month: number,
  n: number
): string | null {
  const days = getWorkDaysInMonth(year, month);
  return n >= 1 && n <= days.length ? days[days.length - n]! : null;
}

/**
 * Return the work-day date (nth or nth-last) for a given calendar month.
 * month: 0-based (0 = Jan, 1 = Feb, ...).
 */
export function workDayDateInMonth(
  year: number,
  month: number,
  type: "monthly_nth_work_day" | "monthly_nth_last_work_day",
  n: number
): string | null {
  if (type === "monthly_nth_work_day") return nthWorkDayOfMonth(year, month, n);
  return nthLastWorkDayOfMonth(year, month, n);
}

/**
 * Compute next run date from current run date (e.g. anchor or last run).
 * intervalMonths: used for interval_months; intervalDays for interval_days.
 * workDayIndex: 1-based, used for monthly_nth_work_day / monthly_nth_last_work_day.
 */
export function nextRunDate(
  from: string,
  recurrenceType: RecurrenceType,
  intervalMonths: number | null,
  workDayIndex: number | null = null,
  intervalDays: number | null = null
): string {
  const d = new Date(from + "T12:00:00Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  if (recurrenceType === "daily") {
    d.setUTCDate(day + 1);
    return d.toISOString().slice(0, 10);
  }
  if (recurrenceType === "weekly") {
    d.setUTCDate(day + 7);
    return d.toISOString().slice(0, 10);
  }
  if (recurrenceType === "monthly") {
    const next = new Date(Date.UTC(y, m + 1, 1));
    const lastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next.toISOString().slice(0, 10);
  }
  if (recurrenceType === "yearly") {
    const next = new Date(Date.UTC(y + 1, m, 1));
    const lastDay = new Date(Date.UTC(y + 1, m + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next.toISOString().slice(0, 10);
  }
  if (
    recurrenceType === "interval_days" &&
    intervalDays != null &&
    intervalDays > 0
  ) {
    d.setUTCDate(day + intervalDays);
    return d.toISOString().slice(0, 10);
  }
  if (
    recurrenceType === "interval_months" &&
    intervalMonths != null &&
    intervalMonths > 0
  ) {
    const next = new Date(Date.UTC(y, m + intervalMonths, 1));
    const lastDay = new Date(
      Date.UTC(y, m + intervalMonths + 1, 0)
    ).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next.toISOString().slice(0, 10);
  }
  const n = workDayIndex ?? 1;
  if (recurrenceType === "monthly_nth_work_day") {
    const next = nthWorkDayOfMonth(y, m + 1, n);
    return next ?? from;
  }
  if (recurrenceType === "monthly_nth_last_work_day") {
    const next = nthLastWorkDayOfMonth(y, m + 1, n);
    return next ?? from;
  }
  return from;
}

const SCHEDULE_SEP = "──────────";

export type RecurrenceOption =
  | { value: RecurrenceType; label: string }
  | { value: ""; label: string; separator: true };

/** Schedule options in order, with separators. Use in Recurring Schedule dropdown. */
export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "", label: SCHEDULE_SEP, separator: true },
  { value: "interval_days", label: "Every x days" },
  { value: "interval_months", label: "Every x months" },
  { value: "", label: SCHEDULE_SEP, separator: true },
  { value: "monthly_nth_work_day", label: "nth work day of the month" },
  { value: "monthly_nth_last_work_day", label: "nth last work day of the month" },
];

export function isRecurrenceOptionSeparator(
  o: RecurrenceOption
): o is { value: ""; label: string; separator: true } {
  return "separator" in o && o.separator === true;
}
