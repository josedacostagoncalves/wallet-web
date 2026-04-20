/**
 * Elapsed month count for a date range, matching {@link StatementsTable} `elapsedMonthCount`
 * (denominator for the "Average" / Média column: total ÷ this value).
 */
export function statementsElapsedMonthCountForRange(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const effectiveEnd = now < end ? now : end;

  if (effectiveEnd < start) return 0;

  return (
    (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
    (effectiveEnd.getMonth() - start.getMonth()) +
    1
  );
}
