import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";

export default async function ActivityPage() {
  const t = await getTranslations("activity");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("activity_log")
    .select("id, action, entity_type, entity_id, wallet_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  const list = rows ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-6 text-slate-500">{t("empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3">{t("table.when")}</th>
                  <th className="text-left p-3">{t("table.action")}</th>
                  <th className="text-left p-3">{t("table.entity")}</th>
                  <th className="text-left p-3">{t("table.details")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 dark:border-slate-700/50"
                  >
                    <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {new Date(r.created_at).toLocaleString("pt-PT", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-3 font-medium">{r.action}</td>
                    <td className="p-3">
                      {r.entity_type && r.entity_id ? (
                        <span>
                          {r.entity_type} {r.entity_id.slice(0, 8)}…
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {r.payload && typeof r.payload === "object"
                        ? JSON.stringify(r.payload)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
