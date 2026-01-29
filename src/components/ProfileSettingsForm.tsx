"use client";

import { updateProfile } from "@/app/actions/profiles";
import { useToast } from "@/contexts/ToastContext";
import { UserIcon } from "@/components/UserIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export function ProfileSettingsForm({ first_name, last_name, avatar_url }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await updateProfile(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast("Profile saved successfully.", "success");
    router.push("/home");
    router.refresh();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPhotoPreview(null);
      return;
    }
    const u = URL.createObjectURL(f);
    setPhotoPreview(u);
  }

  const displayUrl = photoPreview ?? avatar_url;

  return (
    <div className="max-w-md space-y-6">
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6">
        <div className="flex flex-col items-start gap-4">
          <label className="block text-sm font-medium">Photo</label>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="w-14 h-14" />
              )}
            </div>
            <div className="flex flex-col gap-2">
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {avatar_url || photoPreview ? "Change photo" : "Add photo"}
              </button>
              <span className="text-xs text-slate-500">
                JPEG, PNG, WebP or GIF. Max 2 MB.
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="first_name" className="block text-sm font-medium mb-1">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            defaultValue={first_name ?? ""}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>

        <div>
          <label htmlFor="last_name" className="block text-sm font-medium mb-1">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            defaultValue={last_name ?? ""}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <Link
            href="/home"
            className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
