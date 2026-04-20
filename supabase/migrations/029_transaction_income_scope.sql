-- User-scoped vs wallet-scoped income (additive; existing rows merged via UPDATE)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS income_scope text;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_income_scope_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_income_scope_check
  CHECK (
    income_scope IS NULL
    OR income_scope IN ('wallet', 'user')
  );

COMMENT ON COLUMN public.transactions.income_scope IS
  'Income only: user = include this income in totals for all wallets the creator uses; wallet = only this wallet. NULL for expense/transfer.';

-- Merge existing incomes into user-scoped semantics (same rows, no delete)
UPDATE public.transactions
SET income_scope = 'user'
WHERE type = 'income';

UPDATE public.transactions
SET income_scope = NULL
WHERE type <> 'income';

-- Allow creator to read their user-scoped incomes even when browsing another wallet (client uses OR filter)
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (
    is_wallet_member(wallet_id, auth.uid())
    OR (
      type = 'income'
      AND income_scope = 'user'
      AND created_by = auth.uid()
    )
  );
