"use client";

import { confirmMovement, deleteMovement } from "@/app/actions/movements";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  status: "confirmed" | "pending";
  /** Called after confirm/cancel (e.g. to refetch client-held movement lists). */
  onAfterAction?: () => void | Promise<void>;
  /** When true and status is pending, show Edit in addition to Confirm/Cancel. */
  showEdit?: boolean;
};

export function MovementRowActions({ id, status, onAfterAction, showEdit }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await confirmMovement(id);
    setLoading(false);
    router.refresh();
    await onAfterAction?.();
  }

  async function handleCancel() {
    setLoading(true);
    await deleteMovement(id);
    setLoading(false);
    router.refresh();
    await onAfterAction?.();
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-2">
        {showEdit && (
          <>
            <Link href={`/movements/${id}/edit`} className="text-slate-500 hover:underline text-xs">
              Edit
            </Link>
            <span className="text-slate-400" aria-hidden>|</span>
          </>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-green-600 hover:underline text-xs disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="text-red-600 hover:underline text-xs disabled:opacity-50"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex gap-2">
      <Link href={`/movements/new?copy=${id}`} className="text-slate-500 hover:underline text-xs">
        Copy
      </Link>
      <Link href={`/movements/${id}/edit`} className="text-slate-500 hover:underline text-xs">
        Edit
      </Link>
    </span>
  );
}
