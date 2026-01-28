/**
 * Format "Category :: Subcategory" for tables. No subcategory → only category.
 */
export function formatCategorySubcategory(
  categoryLabel: string,
  subcategoryLabel: string
): string {
  const sub = (subcategoryLabel ?? "").trim();
  if (sub === "" || sub === "—") return categoryLabel || "—";
  return `${categoryLabel} :: ${subcategoryLabel}`;
}

/**
 * Format "From → To" for tables. Omit "—" when account missing; only "→" and existing names.
 */
export function formatFromTo(
  accountFromName: string,
  accountToName: string
): string {
  const from = (accountFromName ?? "").trim();
  const to = (accountToName ?? "").trim();
  const hasFrom = from !== "" && from !== "—";
  const hasTo = to !== "" && to !== "—";
  if (hasFrom && hasTo) return `${from} → ${to}`;
  if (hasFrom) return `${from} →`;
  if (hasTo) return `→ ${to}`;
  return "—";
}
