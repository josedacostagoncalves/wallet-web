"use client";

import { useRouter } from "next/navigation";

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
    if (!settlements || settlements.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                <h3 className="text-lg font-semibold mb-4">Settlement Balances</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    No settlements yet. Create an expense to see how it&apos;s split among members.
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
            <h3 className="text-lg font-semibold mb-4">Settlement Balances</h3>

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
                            ? "is owed"
                            : settlement.balance < 0
                                ? "owes"
                                : "settled";

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
                                    <p>Paid: {(settlement.total_paid / 100).toLocaleString()} €</p>
                                    <p>Share: {(settlement.total_share / 100).toLocaleString()} €</p>
                                    {isByIncome && (
                                        <p className="mt-1 text-xs">
                                            (Income-based split)
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className={`text-lg font-semibold ${balanceClass}`}>
                                    {settlement.balance > 0 ? "+" : ""}
                                    {(settlement.balance / 100).toLocaleString()} €
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
                    <span className="font-medium">Positive balance:</span> This member has paid more than their share and is owed money.
                    <br />
                    <span className="font-medium">Negative balance:</span> This member has paid less than their share and owes money.
                </p>
            </div>
        </div>
    );
}
