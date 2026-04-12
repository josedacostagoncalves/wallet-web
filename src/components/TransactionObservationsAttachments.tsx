"use client";

import {
  deleteTransactionAttachment,
  getTransactionAttachmentSignedUrl,
  uploadTransactionAttachment,
  type TransactionAttachmentRow,
} from "@/app/actions/transaction-attachments";
import { validateTransactionAttachmentFile } from "@/lib/transaction-attachments";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

function formatFileSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  observations: string;
  onObservationsChange: (v: string) => void;
  walletId: string | null;
  /** When null (new transaction not saved yet), selected files are queued in `pendingFiles`. */
  transactionId: string | null;
  attachments: TransactionAttachmentRow[];
  onAttachmentsChange: (rows: TransactionAttachmentRow[]) => void;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  fileError: string | null;
  onFileError: (msg: string | null) => void;
  disabled?: boolean;
  textareaClassName: string;
  labelClassName?: string;
};

export function TransactionObservationsAttachments({
  observations,
  onObservationsChange,
  walletId,
  transactionId,
  attachments,
  onAttachmentsChange,
  pendingFiles,
  onPendingFilesChange,
  fileError,
  onFileError,
  disabled,
  textareaClassName,
  labelClassName = "block text-xs font-medium mb-1",
}: Props) {
  const t = useTranslations("transactions.form.fields");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = async (list: FileList | null) => {
    if (!list?.length || !walletId || disabled) return;
    const file = list[0];
    const err = validateTransactionAttachmentFile(file);
    if (err) {
      onFileError(err);
      return;
    }
    onFileError(null);

    if (!transactionId) {
      onPendingFilesChange([...pendingFiles, file]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadTransactionAttachment(walletId, transactionId, fd);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.error) {
      onFileError(res.error);
      return;
    }
    if (res.attachment) {
      onAttachmentsChange([...attachments, res.attachment]);
    }
  };

  const removePending = (idx: number) => {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== idx));
  };

  const removeSaved = async (id: string) => {
    const res = await deleteTransactionAttachment(id);
    if (res.error) {
      onFileError(res.error);
      return;
    }
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
    onFileError(null);
  };

  const download = async (id: string) => {
    const res = await getTransactionAttachmentSignedUrl(id);
    if (res.error) {
      onFileError(res.error);
      return;
    }
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="tx-observations" className={labelClassName}>
          {t("observations")}
        </label>
        <textarea
          id="tx-observations"
          value={observations}
          onChange={(e) => onObservationsChange(e.target.value)}
          rows={3}
          maxLength={8000}
          disabled={disabled}
          placeholder={t("observationsPlaceholder")}
          className={textareaClassName}
        />
      </div>
      <div>
        <p className={labelClassName}>{t("attachments")}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">{t("attachmentsHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpeg,.jpg,.png,.heic,.xlsx,application/pdf,image/jpeg,image/png,image/heic,image/heif,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={disabled || uploading || !walletId}
          onChange={(e) => void handlePick(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled || uploading || !walletId}
          onClick={() => inputRef.current?.click()}
          className="text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {uploading ? t("attachmentUploading") : t("attachFile")}
        </button>
        {!transactionId && pendingFiles.length > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t("attachmentsPendingHint")}</p>
        )}
        {fileError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fileError}</p>}
        {(attachments.length > 0 || pendingFiles.length > 0) && (
          <ul className="mt-2 space-y-1.5 text-xs">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 justify-between rounded border border-slate-200 dark:border-slate-700 px-2 py-1.5 bg-slate-50/80 dark:bg-slate-800/50"
              >
                <span className="truncate text-slate-700 dark:text-slate-200 max-w-[200px]" title={a.file_name}>
                  {a.file_name}
                </span>
                <span className="text-slate-500 shrink-0">
                  {a.size_bytes != null ? formatFileSize(a.size_bytes) : "—"}
                </span>
                <span className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={() => void download(a.id)}
                  >
                    {t("attachmentDownload")}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    className="text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                    onClick={() => void removeSaved(a.id)}
                  >
                    {t("attachmentRemove")}
                  </button>
                </span>
              </li>
            ))}
            {pendingFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex flex-wrap items-center gap-2 justify-between rounded border border-dashed border-amber-300 dark:border-amber-700 px-2 py-1.5 bg-amber-50/50 dark:bg-amber-900/10"
              >
                <span className="truncate text-slate-700 dark:text-slate-200 max-w-[200px]" title={f.name}>
                  {f.name} <span className="text-amber-700 dark:text-amber-300">({t("attachmentPending")})</span>
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  className="text-rose-600 dark:text-rose-400 hover:underline text-[11px] disabled:opacity-50"
                  onClick={() => removePending(i)}
                >
                  {t("attachmentRemove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
