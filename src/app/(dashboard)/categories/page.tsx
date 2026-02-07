import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import Link from "next/link";

type Cat = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  is_active: boolean;
  children: Cat[];
};

export default async function CategoriesPage() {
  const supabase = await createClient();
  const cookie = await getWalletCookie();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true)
    .is("deleted_at", null);
  const walletIds = (wallets ?? []).map((w) => w.id);
  const currentWalletId =
    cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

  let categories: Cat[] = [];

  if (currentWalletId) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, type, parent_id, is_active")
      .eq("wallet_id", currentWalletId)
      .order("name");
    const list = (data ?? []) as Cat[];
    const byParent: Record<string, Cat[]> = {};
    const roots: Cat[] = [];
    for (const c of list) {
      (c as Cat).children = [];
      if (c.parent_id) {
        byParent[c.parent_id] = byParent[c.parent_id] ?? [];
        byParent[c.parent_id].push(c);
      } else {
        roots.push(c);
      }
    }
    for (const r of roots) {
      r.children = byParent[r.id] ?? [];
    }
    categories = roots;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        {currentWalletId && (
          <Link
            href="/categories/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Add category
          </Link>
        )}
      </div>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
        </p>
      ) : (
        <div className="space-y-6">
          {(["income", "expense", "transfer"] as const).map((t) => {
            const forType = categories.filter((c) => c.type === t);
            if (forType.length === 0) return null;
            return (
              <section key={t}>
                <h2 className="text-lg font-medium capitalize mb-2">{t}</h2>
                <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  {forType.map((c) => (
                    <li key={c.id}>
                      <div
                        className={`flex items-center justify-between px-4 py-3 ${
                          !c.is_active ? "opacity-60" : ""
                        }`}
                      >
                        <span className="font-medium">{c.name}</span>
                        <div className="flex items-center gap-3">
                          {!c.is_active && (
                            <span className="text-slate-500 text-sm">Inactive</span>
                          )}
                          <Link
                            href={`/categories/${c.id}/edit`}
                            className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                      {c.children.length > 0 && (
                        <ul className="bg-slate-50/50 dark:bg-slate-800/30 pl-6 pr-4 pb-2">
                          {c.children.map((sub) => (
                            <li
                              key={sub.id}
                              className={`flex items-center justify-between py-2 ${
                                !sub.is_active ? "opacity-60" : ""
                              }`}
                            >
                              <span>{sub.name}</span>
                              <Link
                                href={`/categories/${sub.id}/edit`}
                                className="text-sm text-slate-500 hover:underline"
                              >
                                Edit
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {categories.length === 0 && (
            <p className="text-slate-500">
              No categories.{" "}
              <Link href="/categories/new" className="underline">
                Add one
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
