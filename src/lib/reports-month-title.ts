/** Month keys under the `calendar` namespace — same order as `Date#getMonth()`. */
export const CALENDAR_MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type CalendarMonthTranslationKey = (typeof CALENDAR_MONTH_KEYS)[number];

/** Matches `DashboardCalendar` header: `{monthName} {year}` using app month names. */
export function formatReportsMonthTitle(
  monthIndex: number,
  year: number,
  tCalendar: (key: CalendarMonthTranslationKey) => string
): string {
  const key = CALENDAR_MONTH_KEYS[monthIndex] ?? "january";
  return `${tCalendar(key)} ${year}`;
}
