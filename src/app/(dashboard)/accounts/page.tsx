"use client";

import { getAccountDetails } from "@/app/actions/accounts";
import {
  getAccountsTableDisplayOptions,
  saveAccountsTableDisplayOptions,
} from "@/app/actions/preferences";
import { EditIcon } from "@/components/ActionIcons";
import { AvatarImage } from "@/components/AvatarImage";
import { EditAccountModal } from "@/components/EditAccountModal";
import { UserIcon } from "@/components/UserIcon";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  accountTypeLabel,
  accountTypeIcon,
  type AccountType,
} from "@/lib/account-types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type AccountDetails = {
  ownerName: string;
  ownerAvatar: string | null;
  createdAt: string;
  initialBalance: number;
  isActive: boolean;
  updatedAt: string;
  accountType: string;
  plafond: number | null;
};

type AccountsTableDisplayOptions = {
  showInitialBalance: boolean;
  showPlafond: boolean;
};

const DEFAULT_ACCOUNTS_DISPLAY: AccountsTableDisplayOptions = {
  showInitialBalance: true,
  showPlafond: true,
};

interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  current_balance: number;
  plafond: number | null;
  is_active: boolean;
}

/* ─── Small SVG icons ─── */

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.576 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-4.963" />
        <path d="m2 2 20 20" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function fmt(n: number) {
  return n.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ─── Details Popup ─── */

function AccountDetailsPopup({
  details,
  accountName,
  onClose,
}: {
  details: AccountDetails;
  accountName: string;
  onClose: () => void;
}) {
  const tAccounts = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={tCommon("close")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold">{accountName}</h2>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-slate-500">{tAccounts("page.details.createdBy")}</div>
            <div className="flex items-center gap-2 font-medium">
              <AvatarImage
                src={details.ownerAvatar}
                size={20}
                className="h-5 w-5 rounded-full object-cover"
                fallback={
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  </span>
                }
              />
              {details.ownerName}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500">{tAccounts("page.details.createdAt")}</div>
            <div className="font-medium">
              {new Date(details.createdAt).toLocaleDateString("pt-PT")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500">{tAccounts("page.details.initialBalance")}</div>
            <div className="font-medium font-mono">{fmt(details.initialBalance)} €</div>
          </div>
          {details.plafond != null && (
            <div className="space-y-0.5">
              <div className="text-slate-500">{tAccounts("page.details.plafond")}</div>
              <div className="font-medium font-mono">{fmt(details.plafond)} €</div>
            </div>
          )}
          <div className="space-y-0.5">
            <div className="text-slate-500">{tAccounts("page.details.lastUpdate")}</div>
            <div className="font-medium">
              {new Date(details.updatedAt).toLocaleDateString("pt-PT")},{" "}
              {new Date(details.updatedAt).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>
    </div >,
    document.body
  );
}

/* ─── Main Page ─── */

export default function AccountsPage() {
  const tAccounts = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const tHomeAccounts = useTranslations("home.accountsTable");
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Details popup
  const [detailsPopup, setDetailsPopup] = useState<{
    accountName: string;
    details: AccountDetails;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Edit modal
  const [editAccountId, setEditAccountId] = useState<string | null>(null);

  // Hide balances
  const [hideBalances, setHideBalances] = useState(false);

  // Display options (persisted per wallet)
  const [displayOpts, setDisplayOpts] = useState<AccountsTableDisplayOptions>(DEFAULT_ACCOUNTS_DISPLAY);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const optionsPopRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);

  const loadAccounts = useCallback(() => {
    if (!currentWalletId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("id, name, account_type, initial_balance, current_balance, plafond, is_active")
      .eq("wallet_id", currentWalletId)
      .order("name")
      .then(({ data }) => {
        const mapped = (data ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          account_type: (a.account_type ?? "bank_account") as AccountType,
          initial_balance: Number(a.initial_balance),
          current_balance: Number(a.current_balance),
          plafond: a.plafond != null ? Number(a.plafond) : null,
          is_active: a.is_active,
        }));
        mapped.sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setAccounts(mapped);
        setLoading(false);
      });
  }, [currentWalletId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Load display options from DB
  useEffect(() => {
    if (!currentWalletId) return;
    let cancelled = false;
    getAccountsTableDisplayOptions(currentWalletId).then((opts) => {
      if (!cancelled) setDisplayOpts(opts);
    });
    return () => { cancelled = true; };
  }, [currentWalletId]);

  // Options popover toggle
  const toggleOptions = useCallback(() => {
    setOptionsOpen((prev) => {
      if (!prev && optionsBtnRef.current) {
        const rect = optionsBtnRef.current.getBoundingClientRect();
        setPopPos({ top: rect.bottom + 6, left: rect.right });
      }
      return !prev;
    });
  }, []);

  const toggleDisplayOpt = useCallback(
    (key: keyof AccountsTableDisplayOptions) => {
      setDisplayOpts((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        if (currentWalletId) saveAccountsTableDisplayOptions(currentWalletId, next);
        return next;
      });
    },
    [currentWalletId]
  );

  // Close popover on outside click / scroll
  useEffect(() => {
    if (!optionsOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        optionsBtnRef.current?.contains(e.target as Node) ||
        optionsPopRef.current?.contains(e.target as Node)
      )
        return;
      setOptionsOpen(false);
    }
    function handleScroll() { setOptionsOpen(false); }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [optionsOpen]);

  const hasAnyCreditCard = accounts.some((a) => a.account_type === "credit_card");

  async function handleInfoClick(a: Account) {
    if (loadingDetails) return;
    setLoadingDetails(a.id);
    const res = await getAccountDetails(a.id);
    setLoadingDetails(null);
    if (res.error || !res.details) {
      showToast(res.error ?? tAccounts("page.details.loadError"), "error");
      return;
    }
    setDetailsPopup({ accountName: a.name, details: res.details });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{tAccounts("title")}</h1>
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{tAccounts("title")}</h1>
        {currentWalletId && (
          <Link
            href="/accounts/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            {tAccounts("addAccount")}
          </Link>
        )}
      </div>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          {tAccounts("page.noWallet")}
        </p>
      ) : (
        <>
          {/* Hide balances + Options buttons */}
          {accounts.length > 0 && (
            <div className="flex justify-end gap-2 mb-2">
              <button
                onClick={() => setHideBalances((p) => !p)}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
                aria-label={hideBalances ? tHomeAccounts("showBalances") : tHomeAccounts("hideBalances")}
                title={hideBalances ? tHomeAccounts("showBalances") : tHomeAccounts("hideBalances")}
              >
                <EyeIcon hidden={hideBalances} />
              </button>
              <button
                ref={optionsBtnRef}
                onClick={toggleOptions}
                className={`p-2 rounded-lg border transition-colors ${optionsOpen
                  ? "border-slate-400 bg-slate-100 text-slate-800"
                  : "border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800"
                  }`}
                title={tHomeAccounts("displayOptions")}
              >
                <OptionsIcon />
              </button>
            </div>
          )}

          {/* Options popover */}
          {optionsOpen && popPos && createPortal(
            <div
              ref={optionsPopRef}
              className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 space-y-2 w-56"
              style={{ top: popPos.top, left: popPos.left, transform: "translateX(-100%)" }}
            >
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={displayOpts.showInitialBalance}
                  onChange={() => toggleDisplayOpt("showInitialBalance")}
                />
                {tHomeAccounts("showInitialBalance")}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={displayOpts.showPlafond}
                  onChange={() => toggleDisplayOpt("showPlafond")}
                />
                {tHomeAccounts("showPlafondInfo")}
              </label>
            </div>,
            document.body
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {accounts.length === 0 ? (
              <div className="p-6 text-slate-500">
                {tAccounts("noAccounts")}.{" "}
                <Link href="/accounts/new" className="underline">
                  {tAccounts("page.addOne")}
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left p-3">{tAccounts("accountName")}</th>
                    <th className="text-left p-3">{tAccounts("accountType")}</th>
                    {displayOpts.showInitialBalance && (
                      <th className="text-right p-3">{tAccounts("page.table.initial")}</th>
                    )}
                    <th className="text-right p-3">{tAccounts("page.table.current")}</th>
                    {displayOpts.showPlafond && hasAnyCreditCard && (
                      <th className="text-right p-3">{tAccounts("page.table.plafond")}</th>
                    )}
                    <th className="text-left p-3">{tAccounts("page.table.status")}</th>
                    <th className="text-left p-3 w-20">{tAccounts("page.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 ${!a.is_active ? "opacity-60" : ""
                        }`}
                    >
                      <td className="p-3 font-medium">
                        <span
                          className="inline-flex items-center gap-2"
                          title={accountTypeLabel(a.account_type)}
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {accountTypeIcon(a.account_type)}
                          </span>
                          {a.name}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {accountTypeLabel(a.account_type)}
                      </td>
                      {displayOpts.showInitialBalance && (
                        <td className="p-3 text-right font-mono">
                          {hideBalances ? "••••••" : `${fmt(a.initial_balance)} €`}
                        </td>
                      )}
                      <td className="p-3 text-right font-mono">
                        {hideBalances ? "••••••" : `${fmt(a.current_balance)} €`}
                      </td>
                      {displayOpts.showPlafond && hasAnyCreditCard && (
                        <td className="p-3 text-right font-mono">
                          {a.account_type === "credit_card" && a.plafond != null
                            ? hideBalances ? "••••••" : `${fmt(a.plafond)} €`
                            : "—"}
                        </td>
                      )}
                      <td className="p-3">
                        {a.is_active ? (
                          <span className="text-green-600 dark:text-green-400">
                            {tAccounts("page.status.active")}
                          </span>
                        ) : (
                          <span className="text-slate-500">{tAccounts("page.status.inactive")}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInfoClick(a)}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            title={tAccounts("page.actions.details")}
                            disabled={loadingDetails === a.id}
                          >
                            {loadingDetails === a.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            ) : (
                              <InfoIcon className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditAccountId(a.id)}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            title={tCommon("edit")}
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Details popup */}
      {detailsPopup && (
        <AccountDetailsPopup
          accountName={detailsPopup.accountName}
          details={detailsPopup.details}
          onClose={() => setDetailsPopup(null)}
        />
      )}

      {/* Edit account modal */}
      {editAccountId && (
        <EditAccountModal
          accountId={editAccountId}
          open={true}
          onClose={() => setEditAccountId(null)}
          onSaved={loadAccounts}
        />
      )}
    </div>
  );
}
