import { getRequestConfig } from 'next-intl/server';
import { getOrEnsureProfile } from './app/actions/profiles';
import { createClient } from './lib/supabase/server';

export default getRequestConfig(async () => {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // User not authenticated, fallback to English
            return {
                locale: 'en',
                messages: (await import(`../messages/en.json`)).default
            };
        }

        const profile = await getOrEnsureProfile(user.id);
        const locale = profile?.language || 'en';

        return {
            locale,
            messages: (await import(`../messages/${locale}.json`)).default
        };
    } catch (error) {
        // Fallback to English if profile fetch fails
        return {
            locale: 'en',
            messages: (await import(`../messages/en.json`)).default
        };
    }
});
