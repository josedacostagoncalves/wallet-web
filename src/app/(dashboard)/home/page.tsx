import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { getHomeBriefing, type HomeInsightsPeriod } from "@/app/actions/home-insights";
import { HomeSmartBriefing } from "@/components/HomeSmartBriefing";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { insightPeriod?: string };
}) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as "en" | "pt" | "es" | "fr";
  const supabase = await createClient();
  const cookie = await getWalletCookie();
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true)
    .is("deleted_at", null);
  const walletIds = (wallets ?? []).map((w) => w.id);
  const currentWalletId = cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;
  const rawPeriod = searchParams?.insightPeriod ?? "auto";
  const selectedPeriod: HomeInsightsPeriod =
    rawPeriod === "month_to_date" ||
      rawPeriod === "last_month" ||
      rawPeriod === "this_year" ||
      rawPeriod === "last_30_days"
      ? rawPeriod
      : "auto";

  const briefing = currentWalletId
    ? await getHomeBriefing(currentWalletId, locale, selectedPeriod)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">{t("subtitle")}</p>
      </div>
      {!currentWalletId || !briefing ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">{t("emptyMessage")}</p>
          <Link
            href="/wallets"
            className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            {t("createWallet")}
          </Link>
        </div>
      ) : (
        <HomeSmartBriefing walletId={currentWalletId} data={briefing} selectedPeriod={selectedPeriod} />
      )}
    </div>
  );
}
