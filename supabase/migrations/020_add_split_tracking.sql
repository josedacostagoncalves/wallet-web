-- Add split type to wallets and member income tracking

-- 1. Add split_type to wallets (when shared_option is 'split' or 'track_and_split')
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS split_type TEXT;

-- Add constraint for split_type
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_split_type_check CHECK (
  split_type IS NULL OR split_type IN ('equally', 'by_income')
);

-- Add comment
COMMENT ON COLUMN public.wallets.split_type IS 'How expenses are split: "equally" for equal split, "by_income" for income-proportional split. Only used when shared_option is "split" or "track_and_split".';

-- 2. Add paid_by_member_id to transactions for split tracking
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS paid_by_member_id UUID;

-- Add FK constraint
ALTER TABLE public.transactions
ADD CONSTRAINT fk_transactions_paid_by_member FOREIGN KEY (paid_by_member_id)
REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions.paid_by_member_id IS 'For split wallets: which member paid for this expense (used in "split" and "track_and_split" wallets).';

-- 3. Add income field to wallet_members for income-proportional splits
ALTER TABLE public.wallet_members
ADD COLUMN IF NOT EXISTS income_monthly NUMERIC(12, 2);

ALTER TABLE public.wallet_members
ADD CONSTRAINT wallet_members_income_non_negative CHECK (income_monthly IS NULL OR income_monthly >= 0);

COMMENT ON COLUMN public.wallet_members.income_monthly IS 'Monthly income for this member (used for income-proportional expense splits).';

-- 4. Create a settlement view to calculate who owes whom
CREATE OR REPLACE FUNCTION public.calculate_wallet_settlement(p_wallet_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_email TEXT,
  total_paid NUMERIC,
  total_share NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH member_payments AS (
    -- Total paid by each member
    SELECT 
      t.paid_by_member_id AS member_id,
      SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE 0 END) AS total_paid
    FROM public.transactions t
    WHERE t.wallet_id = p_wallet_id 
      AND t.paid_by_member_id IS NOT NULL
      AND t.is_pending = false
    GROUP BY t.paid_by_member_id
  ),
  member_shares AS (
    -- Calculate each member's share of expenses
    SELECT 
      wm.user_id AS member_id,
      CASE 
        WHEN w.split_type = 'equally' THEN 
          COUNT(DISTINCT t.id) * t.amount / NULLIF(COUNT(DISTINCT t.id) OVER (PARTITION BY t.wallet_id), 0)
        WHEN w.split_type = 'by_income' THEN
          wm.income_monthly / NULLIF(SUM(wm_all.income_monthly) OVER (PARTITION BY w.id), 0) *
          SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE 0 END) OVER (PARTITION BY t.wallet_id)
        ELSE 0
      END AS share
    FROM public.wallet_members wm
    JOIN public.wallets w ON w.id = wm.wallet_id
    LEFT JOIN public.wallet_members wm_all ON wm_all.wallet_id = w.id
    LEFT JOIN public.transactions t ON t.wallet_id = w.id AND t.type = 'expense' AND t.is_pending = false
    WHERE w.id = p_wallet_id
  )
  SELECT 
    wm.user_id,
    p.email,
    COALESCE(mp.total_paid, 0) AS total_paid,
    COALESCE(ms.share, 0) AS total_share,
    COALESCE(mp.total_paid, 0) - COALESCE(ms.share, 0) AS balance
  FROM public.wallet_members wm
  JOIN public.transactions t ON t.wallet_id = p_wallet_id
  LEFT JOIN member_payments mp ON mp.member_id = wm.user_id
  LEFT JOIN member_shares ms ON ms.member_id = wm.user_id
  LEFT JOIN public.profiles p ON p.id = wm.user_id
  WHERE t.wallet_id = p_wallet_id
  GROUP BY wm.user_id, p.email, mp.total_paid, ms.share;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.calculate_wallet_settlement(UUID) IS 'Calculate settlement balances for a split wallet: how much each member paid vs their share of expenses.';
