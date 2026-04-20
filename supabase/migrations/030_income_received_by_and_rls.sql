-- All incomes must record who received the money (auth user id, same as profiles.id).
-- Cross-wallet visibility (user-scoped income) is limited to rows where the viewer is the receiver.

UPDATE public.transactions
SET received_by_member_id = created_by
WHERE type = 'income'
  AND received_by_member_id IS NULL
  AND created_by IS NOT NULL;

-- Recurring income: store intended receiver for generated lines (defaults to created_by in app if null).
ALTER TABLE public.recurring_rules
  ADD COLUMN IF NOT EXISTS income_received_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.recurring_rules.income_received_by_user_id IS
  'Income recurring only: auth user id of member who receives generated transactions; NULL means use created_by.';

-- RLS: user-scoped incomes from other wallets visible only to the member who received them
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (
    is_wallet_member(wallet_id, auth.uid())
    OR (
      type = 'income'
      AND income_scope = 'user'
      AND received_by_member_id = auth.uid()
    )
  );
