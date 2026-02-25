"use client";

import { updateProfile } from "@/app/actions/profiles";
import { AvatarImage } from "@/components/AvatarImage";
import { useToast } from "@/contexts/ToastContext";
import { UserIcon } from "@/components/UserIcon";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Props = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  country: string | null;
  email: string;
};

/* ---- Pencil icon for the Edit Profile button ---- */
function PencilIcon() {
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
      aria-hidden
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function ProfileSettingsForm({
  first_name,
  last_name,
  avatar_url,
  birth_date,
  country,
  email,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  /* ---------- State for the card (reflects latest saved values) ---------- */
  const [savedFirstName, setSavedFirstName] = useState(first_name);
  const [savedLastName, setSavedLastName] = useState(last_name);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(avatar_url);
  const [savedBirthDate, setSavedBirthDate] = useState(birth_date);
  const [savedCountry, setSavedCountry] = useState(country);

  /* ---------- Modal state ---------- */
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  /* Form field state (initialised when modal opens) */
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editCountry, setEditCountry] = useState("");

  const openModal = useCallback(() => {
    setEditFirst(savedFirstName ?? "");
    setEditLast(savedLastName ?? "");
    setEditBirthDate(savedBirthDate ?? "");
    setEditCountry(savedCountry ?? "");
    setPhotoPreview(null);
    setError(null);
    setModalOpen(true);
  }, [savedFirstName, savedLastName, savedBirthDate, savedCountry]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPhotoPreview(null);
    setError(null);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPhotoPreview(null);
      return;
    }
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateProfile(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    /* Update card with newly saved values */
    setSavedFirstName(editFirst || null);
    setSavedLastName(editLast || null);
    setSavedBirthDate(editBirthDate || null);
    setSavedCountry(editCountry || null);
    if (photoPreview) setSavedAvatarUrl(photoPreview);
    showToast(t("profileSection.toastSaved"), "success");
    closeModal();
    router.refresh();
  }

  const displayUrl = savedAvatarUrl;
  const fullName = [savedFirstName, savedLastName].filter(Boolean).join(" ") || "—";

  return (
    <>
      {/* ---- Profile card ---- */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t("profileSection.title")}</h2>
        <div className="flex items-center gap-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 max-w-md">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
            <AvatarImage
              src={displayUrl}
              alt={t("profileSection.avatarAlt")}
              size={64}
              className="h-full w-full object-cover"
              fallback={<UserIcon className="w-10 h-10" />}
            />
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {fullName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {email}
            </p>
          </div>

          {/* Edit button */}
          <button
            type="button"
            onClick={openModal}
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <PencilIcon />
            {t("profileSection.editButton")}
          </button>
        </div>
      </div>

      {/* ---- Edit Profile Modal ---- */}
      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeModal}
              aria-hidden
            />

            {/* Modal panel */}
            <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {t("profileSection.editTitle")}
                </h2>
              </div>

              <form onSubmit={handleSubmit} encType="multipart/form-data" className="px-6 py-5 space-y-5">
                {/* Photo */}
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
                    <AvatarImage
                      src={photoPreview ?? savedAvatarUrl}
                      alt={t("profileSection.avatarAlt")}
                      size={80}
                      className="h-full w-full object-cover"
                      fallback={<UserIcon className="w-12 h-12" />}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="photo"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {savedAvatarUrl || photoPreview ? t("profileSection.photoChange") : t("profileSection.photoAdd")}
                    </button>
                    <span className="text-xs text-slate-500">
                      {t("profileSection.photoHint")}
                    </span>
                  </div>
                </div>

                {/* First name */}
                <div>
                  <label htmlFor="modal_first_name" className="block text-sm font-medium mb-1">
                    {t("profileSection.fields.firstName")}
                  </label>
                  <input
                    id="modal_first_name"
                    name="first_name"
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>

                {/* Last name */}
                <div>
                  <label htmlFor="modal_last_name" className="block text-sm font-medium mb-1">
                    {t("profileSection.fields.lastName")}
                  </label>
                  <input
                    id="modal_last_name"
                    name="last_name"
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label htmlFor="modal_email" className="block text-sm font-medium mb-1">
                    {t("profileSection.fields.email")}
                  </label>
                  <input
                    id="modal_email"
                    type="email"
                    value={email}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Birth date */}
                <div>
                  <label htmlFor="modal_birth_date" className="block text-sm font-medium mb-1">
                    {t("profileSection.fields.birthDate")}
                  </label>
                  <input
                    id="modal_birth_date"
                    name="birth_date"
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>

                {/* Country */}
                <div>
                  <label htmlFor="modal_country" className="block text-sm font-medium mb-1">
                    {t("profileSection.fields.country")}
                  </label>
                  <input
                    id="modal_country"
                    name="country"
                    type="text"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    placeholder={t("profileSection.countryPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-slate-800 dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50"
                  >
                    {loading ? t("profileSection.saving") : tCommon("save")}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
