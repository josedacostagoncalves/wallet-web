-- Allow users to read profiles of other members in their shared wallets.
CREATE POLICY "Users can view profiles of wallet co-members"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.wallet_members wm1
      JOIN public.wallet_members wm2 ON wm1.wallet_id = wm2.wallet_id
      WHERE wm1.user_id = auth.uid()
        AND wm2.user_id = profiles.id
    )
  );

-- Drop the old restrictive policy so only the new broader one applies.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
