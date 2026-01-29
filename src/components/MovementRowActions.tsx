"use client";

import { confirmMovement, deleteMovement } from "@/app/actions/movements";
import { ConfirmIcon, CopyIcon, DeleteIcon, EditIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMovementModals } from "@/contexts/MovementModalsContext";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  status: "confirmed" | "pending";
  /** Called after confirm/cancel/delete (e.g. to refetch client-held movement lists). */
  onAfterAction?: () => void | Promise<void>;
  /** When true and status is pending, show Edit in addition to Confirm/Delete. */
  showEdit?: boolean;
};

type DialogType = "confirm" | "cancel" | "delete" | null;

const iconBtn =
  "p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors";

export function MovementRowActions({ id, status, onAfterAction, showEdit }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { openEditMovement, openCopyMovement } = useMovementModals();
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);

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
            onClick={() => setDialog("confirm")}
            disabled={loading}
            className={`${iconBtn} text-green-600 hover:bg-green-50 hover:text-green-700`}
            title="Confirm"
            aria-label="Confirm"
          >
            <ConfirmIcon aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDialog("delete")}
            disabled={loading}
            className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
            title="Delete"
            aria-label="Delete"
          >
            <DeleteIcon aria-hidden />
          </button>
        </span>
        <ConfirmDialog
          open={dialog === "confirm"}
          onClose={() => setDialog(null)}
          onConfirm={handleConfirmAction}
          title="Confirm movement"
          message="Confirm this pending movement? It will be applied and balances updated."
          confirmLabel="Confirm"
          cancelLabel="Go back"
          variant="confirm"
          loading={loading}
        />
        <ConfirmDialog
          open={dialog === "delete"}
          onClose={() => setDialog(null)}
          onConfirm={handleDeleteAction}
          title="Cancel pending movement"
          message="Cancel this pending movement? It will be deleted."
          confirmLabel="Yes, cancel"
          cancelLabel="Keep"
          variant="cancel"
          loading={loading}
        />
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
        onClick={() => setDialog("delete")}
        disabled={loading}
        className={`${iconBtn} text-red-600 hover:bg-red-50 hover:text-red-700`}
        title="Delete"
        aria-label="Delete"
      >
        <DeleteIcon aria-hidden />
      </button>
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={handleDeleteAction}
        title="Delete movement"
        message="Delete this movement? Balances will be updated."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="cancel"
        loading={loading}
      />
    </span>
  );
}
