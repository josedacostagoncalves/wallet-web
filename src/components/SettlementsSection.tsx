"use client";

import { useLocale, useTranslations } from "next-intl";

type Settlement = {
    member_id: string;
    email: string;
    total_paid: number;
    total_share: number;
    balance: number;
};

type Props = {
    settlements: Settlement[];
    splitType: string | null;
};

export function SettlementsSection({ settlements, splitType }: Props) {
    const t = useTranslations("home.settlements");
    const locale = useLocale();
    const formatAmount = (value: number) =>
        value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!settlements || settlements.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                <h3 className="text-lg font-semibold mb-4">{t("title")}</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    {t("empty")}
                </p>
            </div>
        );
    }

    // Determine if split type is income-based
    const isByIncome = splitType === "by_income";

    // Sort by balance (who owes most at top)
    const sorted = [...settlements].sort((a, b) => b.balance - a.balance);

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <h3 className="text-lg font-semibold mb-4">{t("title")}</h3>

            <div className="space-y-3">
                {sorted.map((settlement) => {
                    const balanceClass =
                        settlement.balance > 0
                            ? "text-green-600 dark:text-green-400"
                            : settlement.balance < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-600 dark:text-slate-400";

                    const balanceLabel =
                        settlement.balance > 0
                            ? t("isOwed")
                            : settlement.balance < 0
                                ? t("owes")
                                : t("settled");

                    return (
                        <div
                            key={settlement.member_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {settlement.email}
                                </p>
                                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    <p>{t("paid")}: {formatAmount(settlement.total_paid / 100)} €</p>
                                    <p>{t("share")}: {formatAmount(settlement.total_share / 100)} €</p>
                                    {isByIncome && (
                                        <p className="mt-1 text-xs">
                                            ({t("incomeBasedSplit")})
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className={`text-lg font-semibold ${balanceClass}`}>
                                    {settlement.balance > 0 ? "+" : ""}
                                    {formatAmount(settlement.balance / 100)} €
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {balanceLabel}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                    <span className="font-medium">{t("positiveBalance")}:</span> {t("positiveHelp")}
                    <br />
                    <span className="font-medium">{t("negativeBalance")}:</span> {t("negativeHelp")}
                </p>
            </div>
        </div>
    );
}
