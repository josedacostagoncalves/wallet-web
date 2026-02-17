import { createClient } from "@/lib/supabase/server";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { DevicesSection } from "@/components/DevicesSection";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";
import { ThemeSelector } from "@/components/ThemeSelector";
import { getTranslations } from 'next-intl/server';

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const t = await getTranslations('settings');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getOrEnsureProfile(user.id, user.user_metadata as { first_name?: string | null; last_name?: string | null } | undefined);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <ProfileSettingsForm
        first_name={profile.first_name}
        last_name={profile.last_name}
        avatar_url={profile.avatar_url}
        birth_date={profile.birth_date}
        country={profile.country}
        email={user.email ?? ""}
      />
      <hr className="border-slate-200 dark:border-slate-700" />
      <ThemeSelector />
      <hr className="border-slate-200 dark:border-slate-700" />
      <LanguageSelector language={profile.language} />
      <hr className="border-slate-200 dark:border-slate-700" />
      <DevicesSection />
    </div>
  );
}
