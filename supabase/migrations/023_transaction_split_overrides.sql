-- Per-transaction split overrides and manual split percentages.

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS received_by_member_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS split_method_override TEXT;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_split_method_override_check;
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_split_method_override_check
CHECK (
  split_method_override IS NULL
  OR split_method_override IN ('equally', 'by_income', 'manual')
);

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  percentage NUMERIC(7,4) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_tx ON public.transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_member ON public.transaction_splits(member_id);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view transaction_splits" ON public.transaction_splits;
CREATE POLICY "Members can view transaction_splits"
  ON public.transaction_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can insert transaction_splits" ON public.transaction_splits;
CREATE POLICY "Members can insert transaction_splits"
  ON public.transaction_splits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can update transaction_splits" ON public.transaction_splits;
CREATE POLICY "Members can update transaction_splits"
  ON public.transaction_splits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can delete transaction_splits" ON public.transaction_splits;
CREATE POLICY "Members can delete transaction_splits"
  ON public.transaction_splits FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

