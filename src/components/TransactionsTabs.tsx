"use client";

import { AllTransactionsSection, type ConfirmedRow } from "@/components/AllTransactionsSection";
import { PendingSection, type PendingRow } from "@/components/PendingSection";
import { RecurringSection, type RecurringRow } from "@/components/RecurringSection";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type TabKey = "all" | "pending" | "recurring";

type Props = {
  confirmed: ConfirmedRow[];
  pending: PendingRow[];
  recurring: RecurringRow[];
  isSplitOnly: boolean;
  /** When true, the hub loaded only the first page of confirmed rows; client can load older chunks. */
  confirmedHubHasMore?: boolean;
};

export function TransactionsTabs({
  confirmed,
  pending,
  recurring,
  isSplitOnly,
  confirmedHubHasMore = false,
}: Props) {
  const t = useTranslations("transactions");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: t("allMovements.title") },
      { key: "pending" as const, label: t("pending.title"), badge: pending.length },
      { key: "recurring" as const, label: t("recurring.title") },
    ],
    [t, pending.length]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-slate-700 bg-slate-900 text-white dark:border-slate-500 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
              aria-pressed={isActive}
            >
              <span>{tab.label}</span>
              {tab.key === "pending" && (
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                    isActive
                      ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "all" && (
        <section>
          <AllTransactionsSection
            confirmed={confirmed}
            isSplitOnly={isSplitOnly}
            confirmedHubHasMore={confirmedHubHasMore}
          />
        </section>
      )}
      {activeTab === "pending" && (
        <section>
          <PendingSection pending={pending} />
        </section>
      )}
      {activeTab === "recurring" && (
        <section>
          <RecurringSection recurring={recurring} initialExpanded />
        </section>
      )}
    </div>
  );
}

