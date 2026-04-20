/** Matches expense form: explicit tx flag overrides; null inherits category leaf `is_essential`. */
export function expenseIsEffectivelyEssential(
  type: string,
  txEssential: boolean | null | undefined,
  category: { is_essential?: boolean | null } | null
): boolean {
  if (type !== "expense") return false;
  if (txEssential === true) return true;
  if (txEssential === false) return false;
  return !!category?.is_essential;
}
