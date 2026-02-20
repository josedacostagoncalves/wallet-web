"use client";

import {
  confirmTransaction,
  deleteTransaction,
  getBalancePreview,
  type BalancePreviewRow,
} from "@/app/actions/transactions";
import { ConfirmIcon, CopyIcon, DeleteIcon, EditIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTransactionModals } from "@/contexts/TransactionModalsContext";
import { useToast } from "@/contexts/ToastContext";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  id: string;
  status: "confirmed" | "pending";
  /** Whether this pending transaction is holding balance (not yet applied). */
  holdBalance?: boolean;
  /** Called after confirm/cancel/delete (e.g. to refetch client-held transaction lists). */
  onAfterAction?: () => void | Promise<void>;
  /** When true and status is pending, show Edit in addition to Confirm/Delete. */
  showEdit?: boolean;
};

type DialogType = "confirm" | "cancel" | "delete" | null;

const iconBtn =
  "p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 transition-colors";

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalancePreviewTable({ rows, labels }: { rows: BalancePreviewRow[]; labels: { account: string; before: string; after: string } }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <hr className="border-slate-200 mb-4" />
      <table className="w-full text-xs rounded-lg overflow-hidden border border-slate-200">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-slate-600">{labels.account}</th>
            <th className="px-3 py-1.5 text-right font-medium text-slate-600">{labels.before}</th>
            <th className="px-3 py-1.5 text-right font-medium text-slate-600">{labels.after}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const changed = r.currentBalance !== r.afterBalance;
            return (
              <tr key={r.accountName}>
                <td className="px-3 py-1.5 text-slate-700">{r.accountName}</td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                  {fmt(r.currentBalance)} €
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-mono ${changed
                    ? r.afterBalance < r.currentBalance
                      ? "text-red-600 font-semibold"
                      : "text-green-600 font-semibold"
                    : "text-slate-600"
                    }`}
                >
                  {fmt(r.afterBalance)} €
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TransactionRowActions({ id, status, holdBalance, onAfterAction, showEdit }: Props) {
  const t = useTranslations("home.transactionActions");
  const router = useRouter();
  const { showToast } = useToast();
  const { openEditTransaction, openCopyTransaction } = useTransactionModals();
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [preview, setPreview] = useState<BalancePreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const openDialog = useCallback(
    async (type: DialogType) => {
      if (!type) return;
      setLoadingPreview(true);
      setDialog(type);
      try {
        const action = type === "confirm" ? "confirm" : "cancel";
        const rows = await getBalancePreview(id, action);
        setPreview(rows);
      } catch {
        setPreview([]);
      }
      setLoadingPreview(false);
    },
    [id]
  );

  async function handleConfirmAction() {
    setLoading(true);
    const res = await confirmTransaction(id);
    setLoading(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setDialog(null);
    showToast(t("transactionConfirmed"));
    router.refresh();
    await onAfterAction?.();
  }

  async function handleDeleteAction() {
    setLoading(true);
    const res = await deleteTransaction(id);
    setLoading(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setDialog(null);
    showToast(status === "pending" ? t("pendingTransactionCanceled") : t("transactionDeleted"));
    router.refresh();
    await onAfterAction?.();
  }

  if (status === "pending") {
    return (
      <>
        <span className="inline-flex items-center gap-1">
          {showEdit && (
            <>
              <button
                type="button"
                onClick={() => openCopyTransaction(id)}
                className={`${iconBtn} text-slate-500 hover:text-slate-700`}
                title={t("copy")}
                aria-label={t("copy")}
              >
                <CopyIcon aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => openEditTransaction(id)}
                className={`${iconBtn} text-slate-500 hover:text-slate-700`}
                title={t("edit")}
                aria-label={t("edit")}
              >
                <EditIcon aria-hidden />
              </button>
              <span className="text-slate-300" aria-hidden>|</span>
            </>
          )}
          <button
            type="button"
            onClick={() => openDialog("confirm")}
            disabled={loading || loadingPreview}
            className={`${iconBtn} text-green-600 hover:bg-green-50 hover:text-green-700`}
            title={t("confirm")}
            aria-label={t("confirm")}
          >
            <ConfirmIcon aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openDialog("delete")}
            disabled={loading || loadingPreview}
            className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
            title={t("delete")}
            aria-label={t("delete")}
          >
            <DeleteIcon aria-hidden />
          </button>
        </span>
        <ConfirmDialog
          open={dialog === "confirm"}
          onClose={() => { setDialog(null); setPreview([]); }}
          onConfirm={handleConfirmAction}
          title={t("confirmTransactionTitle")}
          message={
            holdBalance
              ? t("confirmTransactionMessageWithBalance")
              : t("confirmTransactionMessage")
          }
          confirmLabel={t("confirm")}
          cancelLabel={t("goBack")}
          variant="confirm"
          loading={loading}
        >
          {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} labels={{ account: t("account"), before: t("before"), after: t("after") }} />}
          {loadingPreview && (
            <p className="text-xs text-slate-400 mt-2">{t("loadingBalances")}</p>
          )}
        </ConfirmDialog>
        <ConfirmDialog
          open={dialog === "delete"}
          onClose={() => { setDialog(null); setPreview([]); }}
          onConfirm={handleDeleteAction}
          title={t("cancelPendingTransactionTitle")}
          message={t("cancelPendingTransactionMessage")}
          confirmLabel={t("yesCancel")}
          cancelLabel={t("keep")}
          variant="cancel"
          loading={loading}
        >
          {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} labels={{ account: t("account"), before: t("before"), after: t("after") }} />}
          {loadingPreview && (
            <p className="text-xs text-slate-400 mt-2">{t("loadingBalances")}</p>
          )}
        </ConfirmDialog>
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => openCopyTransaction(id)}
        className={`${iconBtn} text-slate-500 hover:text-slate-700`}
        title={t("copy")}
        aria-label={t("copy")}
      >
        <CopyIcon aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => openEditTransaction(id)}
        className={`${iconBtn} text-slate-500 hover:text-slate-700`}
        title={t("edit")}
        aria-label={t("edit")}
      >
        <EditIcon aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => openDialog("delete")}
        disabled={loading || loadingPreview}
        className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
        title={t("delete")}
        aria-label={t("delete")}
      >
        <DeleteIcon aria-hidden />
      </button>
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => { setDialog(null); setPreview([]); }}
        onConfirm={handleDeleteAction}
        title={t("deleteTransactionTitle")}
        message={t("deleteTransactionMessage")}
        confirmLabel={t("delete")}
        cancelLabel={t("keep")}
        variant="cancel"
        loading={loading}
      >
        {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} labels={{ account: t("account"), before: t("before"), after: t("after") }} />}
        {loadingPreview && (
          <p className="text-xs text-slate-400 mt-2">{t("loadingBalances")}</p>
        )}
      </ConfirmDialog>
    </span>
  );
}
