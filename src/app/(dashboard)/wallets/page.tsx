"use client";

import {
  getWalletDetails,
  getWalletUsage,
  softDeleteWallet,
  undoDeleteWallet,
  type WalletDetails,
} from "@/app/actions/wallets";
import { EditIcon, DeleteIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Wallet {
  id: string;
  name: string;
  is_shared: boolean;
  is_active: boolean;
  deleted_at: string | null;
  delete_after: string | null;
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

function UserIcon() {
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
      className="text-slate-400"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ─── Details Popup ─── */

function WalletDetailsPopup({
  details,
  walletName,
  onClose,
}: {
  details: WalletDetails;
  walletName: string;
  onClose: () => void;
}) {
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

  const ownerName = details.owner
    ? [details.owner.first_name, details.owner.last_name].filter(Boolean).join(" ") || "—"
    : "—";

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
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold">{walletName}</h2>

        {/* Summary info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-slate-500">Owner</div>
            <div className="flex items-center gap-2 font-medium">
              {details.owner?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={details.owner.avatar_url}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <UserIcon />
                </span>
              )}
              {ownerName}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500">Created</div>
            <div className="font-medium">
              {new Date(details.created_at).toLocaleDateString("pt-PT")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500">Accounts</div>
            <div className="font-medium">{details.accountCount}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500">Movements</div>
            <div className="font-medium">{details.movementCount}</div>
          </div>
        </div>

        {/* Members (shared wallets) */}
        {details.is_shared && details.members.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-slate-500">Members</h3>
            <div className="space-y-2">
              {details.members.map((m) => {
                const name =
                  [m.first_name, m.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 p-2"
                  >
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatar_url}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <UserIcon />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {name}
                      </div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {m.role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ─── Main Page ─── */

export default function WalletsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  // Details popup state
  const [detailsPopup, setDetailsPopup] = useState<{
    walletName: string;
    details: WalletDetails;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Wallet | null>(null);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWallets() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: list } = await supabase
      .from("wallet_members")
      .select(
        "wallet_id, wallets(id, name, is_shared, is_active, deleted_at, delete_after)"
      )
      .eq("user_id", user.id);

    const walletsList = (list ?? [])
      .map((m) => {
        const raw = m.wallets as Wallet | Wallet[] | null;
        return Array.isArray(raw) ? raw[0] : raw;
      })
      .filter((w): w is Wallet => w != null)
      .sort((a, b) => {
        if (!a.deleted_at && b.deleted_at) return -1;
        if (a.deleted_at && !b.deleted_at) return 1;
        return a.name.localeCompare(b.name);
      });

    setWallets(walletsList);
    setLoading(false);
  }

  async function handleInfoClick(w: Wallet) {
    if (loadingDetails) return;
    setLoadingDetails(w.id);
    const res = await getWalletDetails(w.id);
    setLoadingDetails(null);
    if (res.error || !res.details) {
      showToast(res.error ?? "Failed to load details", "error");
      return;
    }
    setDetailsPopup({ walletName: w.name, details: res.details });
  }

  async function handleDeleteClick(w: Wallet) {
    const usage = await getWalletUsage(w.id);
    if (usage.error) {
      showToast(usage.error, "error");
      return;
    }
    if (!usage.hasData) {
      setDeleteMsg(
        `Delete wallet "${w.name}"? This wallet has no accounts or movements and will be permanently deleted.`
      );
    } else {
      const parts: string[] = [];
      if (usage.accountCount > 0)
        parts.push(
          `${usage.accountCount} account${usage.accountCount > 1 ? "s" : ""}`
        );
      if (usage.movementCount > 0)
        parts.push(
          `${usage.movementCount} movement${usage.movementCount > 1 ? "s" : ""}`
        );
      setDeleteMsg(
        `Delete wallet "${w.name}"? It contains ${parts.join(" and ")}. All data will be kept for 30 days — you can undo this action during that period.`
      );
    }
    setDeleteTarget(w);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await softDeleteWallet(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    if (res.hardDeleted) {
      showToast("Wallet permanently deleted.");
    } else {
      showToast("Wallet deleted. You can undo within 30 days.");
    }
    await loadWallets();
    router.refresh();
  }

  async function handleUndo(w: Wallet) {
    const res = await undoDeleteWallet(w.id);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    showToast(`Wallet "${w.name}" restored.`);
    await loadWallets();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <div className="flex gap-3">
          <Link
            href="/wallets/join"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Join wallet
          </Link>
          <Link
            href="/wallets/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Create wallet
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {wallets.length === 0 ? (
          <div className="p-6 text-slate-500">
            No wallets.{" "}
            <Link href="/wallets/new" className="underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-3 font-medium text-slate-600">
                  Name
                </th>
                <th className="text-left p-3 font-medium text-slate-600">
                  Type
                </th>
                <th className="text-left p-3 font-medium text-slate-600">
                  Status
                </th>
                <th className="text-left p-3 font-medium text-slate-600 w-28">
                  Actions
                </th>
              </tr>
            </thead>
            {wallets.map((w) => {
              const isSoftDeleted = !!w.deleted_at;

              return (
                <tbody key={w.id}>
                  <tr
                    className={`border-b border-slate-100 ${
                      isSoftDeleted
                        ? "opacity-50 bg-red-50 dark:bg-red-950/20"
                        : !w.is_active
                          ? "opacity-60"
                          : ""
                    }`}
                  >
                    <td className="p-3 font-medium">{w.name}</td>
                    <td className="p-3">
                      {w.is_shared ? "Shared" : "Personal"}
                    </td>
                    <td className="p-3">
                      {isSoftDeleted ? (
                        <span className="text-red-600 dark:text-red-400">
                          Deleted
                          {w.delete_after && (
                            <span className="text-[10px] ml-1 text-slate-500">
                              (until{" "}
                              {new Date(w.delete_after).toLocaleDateString(
                                "pt-PT"
                              )}
                              )
                            </span>
                          )}
                        </span>
                      ) : w.is_active ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isSoftDeleted ? (
                        <button
                          onClick={() => handleUndo(w)}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          Undo delete
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInfoClick(w)}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            title="Details"
                            disabled={loadingDetails === w.id}
                          >
                            {loadingDetails === w.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            ) : (
                              <InfoIcon className="w-4 h-4" />
                            )}
                          </button>
                          <Link
                            href={`/wallets/${w.id}/edit`}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            title="Edit"
                          >
                            <EditIcon className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(w)}
                            className="text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <DeleteIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        )}
      </div>

      {/* Details popup */}
      {detailsPopup && (
        <WalletDetailsPopup
          walletName={detailsPopup.walletName}
          details={detailsPopup.details}
          onClose={() => setDetailsPopup(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete wallet"
        message={deleteMsg}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="cancel"
        loading={deleting}
      />
    </div>
  );
}
