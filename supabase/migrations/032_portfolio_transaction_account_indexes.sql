-- Speed up account_last_transaction_dates and wallet-scoped account filters.
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_account_from_date
  ON public.transactions (wallet_id, account_from_id, date DESC)
  WHERE account_from_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_account_to_date
  ON public.transactions (wallet_id, account_to_id, date DESC)
  WHERE account_to_id IS NOT NULL;
