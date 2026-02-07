"use client";

import {
  confirmMovement,
  deleteMovement,
  getBalancePreview,
  type BalancePreviewRow,
} from "@/app/actions/movements";
import { ConfirmIcon, CopyIcon, DeleteIcon, EditIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMovementModals } from "@/contexts/MovementModalsContext";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  id: string;
  status: "confirmed" | "pending";
  /** Whether this pending movement is holding balance (not yet applied). */
  holdBalance?: boolean;
  /** Called after confirm/cancel/delete (e.g. to refetch client-held movement lists). */
  onAfterAction?: () => void | Promise<void>;
  /** When true and status is pending, show Edit in addition to Confirm/Delete. */
  showEdit?: boolean;
};

type DialogType = "confirm" | "cancel" | "delete" | null;

const iconBtn =
  "p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors";

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalancePreviewTable({ rows }: { rows: BalancePreviewRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <hr className="border-slate-200 mb-4" />
      <table className="w-full text-xs rounded-lg overflow-hidden border border-slate-200">
      <thead className="bg-slate-100">
        <tr>
          <th className="px-3 py-1.5 text-left font-medium text-slate-600">Account</th>
          <th className="px-3 py-1.5 text-right font-medium text-slate-600">Before</th>
          <th className="px-3 py-1.5 text-right font-medium text-slate-600">After</th>
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
                className={`px-3 py-1.5 text-right font-mono ${
                  changed
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

export function MovementRowActions({ id, status, holdBalance, onAfterAction, showEdit }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { openEditMovement, openCopyMovement } = useMovementModals();
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
    const res = await confirmMovement(id);
    setLoading(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setDialog(null);
    showToast("Movement confirmed.");
    router.refresh();
    await onAfterAction?.();
  }

  async function handleDeleteAction() {
    setLoading(true);
    const res = await deleteMovement(id);
    setLoading(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setDialog(null);
    showToast(status === "pending" ? "Pending movement cancelled." : "Movement deleted.");
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
                onClick={() => openCopyMovement(id)}
                className={iconBtn}
                title="Copy"
                aria-label="Copy"
              >
                <CopyIcon aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => openEditMovement(id)}
                className={iconBtn}
                title="Edit"
                aria-label="Edit"
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
            title="Confirm"
            aria-label="Confirm"
          >
            <ConfirmIcon aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openDialog("delete")}
            disabled={loading || loadingPreview}
            className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
            title="Delete"
            aria-label="Delete"
          >
            <DeleteIcon aria-hidden />
          </button>
        </span>
        <ConfirmDialog
          open={dialog === "confirm"}
          onClose={() => { setDialog(null); setPreview([]); }}
          onConfirm={handleConfirmAction}
          title="Confirm movement"
          message={
            holdBalance
              ? "Confirm this pending movement? It will be applied and balances updated."
              : "Confirm this pending movement? It will be applied."
          }
          confirmLabel="Confirm"
          cancelLabel="Go back"
          variant="confirm"
          loading={loading}
        >
          {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} />}
          {loadingPreview && (
            <p className="text-xs text-slate-400 mt-2">Loading balances…</p>
          )}
        </ConfirmDialog>
        <ConfirmDialog
          open={dialog === "delete"}
          onClose={() => { setDialog(null); setPreview([]); }}
          onConfirm={handleDeleteAction}
          title="Cancel pending movement"
          message="Cancel this pending movement? It will be deleted."
          confirmLabel="Yes, cancel"
          cancelLabel="Keep"
          variant="cancel"
          loading={loading}
        >
          {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} />}
          {loadingPreview && (
            <p className="text-xs text-slate-400 mt-2">Loading balances…</p>
          )}
        </ConfirmDialog>
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => openCopyMovement(id)}
        className={iconBtn}
        title="Copy"
        aria-label="Copy"
      >
        <CopyIcon aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => openEditMovement(id)}
        className={iconBtn}
        title="Edit"
        aria-label="Edit"
      >
        <EditIcon aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => openDialog("delete")}
        disabled={loading || loadingPreview}
        className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
        title="Delete"
        aria-label="Delete"
      >
        <DeleteIcon aria-hidden />
      </button>
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => { setDialog(null); setPreview([]); }}
        onConfirm={handleDeleteAction}
        title="Delete movement"
        message="Delete this movement? Balances will be updated."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="cancel"
        loading={loading}
      >
        {!loadingPreview && preview.length > 0 && <BalancePreviewTable rows={preview} />}
        {loadingPreview && (
          <p className="text-xs text-slate-400 mt-2">Loading balances…</p>
        )}
      </ConfirmDialog>
    </span>
  );
}
