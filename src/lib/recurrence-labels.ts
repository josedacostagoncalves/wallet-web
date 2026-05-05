/**
 * Maps recurrence_type DB values to next-intl keys under `transactions.form`.
 * Shared by transaction modals and recurring edit.
 */
const RECURRENCE_VALUE_TO_FORM_KEY: Record<string, string> = {
  daily: "options.scheduleTypes.daily",
  weekly: "options.scheduleTypes.weekly",
  monthly: "options.scheduleTypes.monthly",
  yearly: "options.scheduleTypes.yearly",
  interval_days: "options.scheduleTypes.intervalDays",
  interval_months: "options.scheduleTypes.intervalMonths",
  monthly_nth_work_day: "options.scheduleTypes.monthlyNthWorkDay",
  monthly_nth_last_work_day: "options.scheduleTypes.monthlyNthLastWorkDay",
};

/** Label for a recurrence_type value using `transactions.form` translations. */
export function recurrenceOptionLabel(
  tForm: (key: string) => string,
  value: string,
  fallback: string
): string {
  const key = RECURRENCE_VALUE_TO_FORM_KEY[value];
  return key ? tForm(key) : fallback;
}
