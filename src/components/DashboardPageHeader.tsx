/**
 * Page title + subtitle block — matches Transações (`text-2xl font-semibold` + `mt-1` subtitle).
 * Use on dashboard list pages for consistent typography and spacing.
 */
export function DashboardPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}
