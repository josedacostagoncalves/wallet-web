/**
 * Light, soft background + hover classes for movement table rows by type.
 */
export function movementRowBgClass(type: string): string {
  switch (type) {
    case "income":
      return "bg-green-50 hover:bg-green-100/80";
    case "expense":
      return "bg-red-50 hover:bg-red-100/80";
    case "transfer":
      return "bg-blue-50 hover:bg-blue-100/80";
    default:
      return "bg-white hover:bg-slate-50/50";
  }
}
