-- Fast last-activity date per account for portfolio (avoids loading all movement rows into the app).
CREATE OR REPLACE FUNCTION public.account_last_transaction_dates(
  p_wallet_id uuid,
  p_account_ids uuid[]
)
RETURNS TABLE (account_id uuid, last_date date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT x.account_id, max(x.d)::date AS last_date
  FROM (
    SELECT t.account_from_id AS account_id, t.date::date AS d
    FROM public.transactions t
    WHERE t.wallet_id = p_wallet_id
      AND t.account_from_id IS NOT NULL
      AND t.account_from_id = ANY (p_account_ids)
    UNION ALL
    SELECT t.account_to_id AS account_id, t.date::date AS d
    FROM public.transactions t
    WHERE t.wallet_id = p_wallet_id
      AND t.account_to_id IS NOT NULL
      AND t.account_to_id = ANY (p_account_ids)
  ) x
  GROUP BY x.account_id;
$$;

COMMENT ON FUNCTION public.account_last_transaction_dates(uuid, uuid[]) IS
  'Returns the latest transaction date per account for a wallet (from/to sides). Used by portfolio.';
