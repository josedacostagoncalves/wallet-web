/** Allowed extensions (lowercase, no dot) for transaction attachments. */
export const TRANSACTION_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "jpeg",
  "jpg",
  "png",
  "heic",
  "xlsx",
]);

export const TRANSACTION_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export function extensionFromFileName(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

/** Returns error message or null if OK. */
export function validateTransactionAttachmentFile(file: File): string | null {
  if (!file || file.size <= 0) return "Invalid file";
  if (file.size > TRANSACTION_ATTACHMENT_MAX_BYTES) return "File is too large (max 15 MB)";
  const ext = extensionFromFileName(file.name);
  if (!ext || !TRANSACTION_ATTACHMENT_EXTENSIONS.has(ext)) {
    return "Allowed types: PDF, JPEG, PNG, HEIC, XLSX";
  }
  if (!file.type) return null;
  if (ALLOWED_MIME.has(file.type)) return null;
  return "Unsupported file type";
}

export function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").slice(0, 180);
  return base.replace(/[^\w.\-()+ ]/g, "_") || "file";
}
