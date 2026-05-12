-- Let members of the same shared split wallet see each other's user-scoped incomes
-- posted in other wallets (received_by_member_id), while keeping wallet-only incomes private.

DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;

CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (
    is_wallet_member(wallet_id, auth.uid())
    OR (
      type = 'income'
      AND COALESCE(income_scope, 'user') IS DISTINCT FROM 'wallet'
      AND (
        received_by_member_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.wallet_members wm_recv
          INNER JOIN public.wallet_members wm_viewer
            ON wm_recv.wallet_id = wm_viewer.wallet_id
          INNER JOIN public.wallets w ON w.id = wm_recv.wallet_id
          WHERE wm_recv.user_id = transactions.received_by_member_id
            AND wm_viewer.user_id = auth.uid()
            AND COALESCE(w.is_shared, false) = true
            AND (
              w.split_mode = 'split'
              OR w.shared_option = 'split'
              OR w.shared_option = 'track_and_split'
            )
        )
      )
    )
  );

COMMENT ON POLICY "Members can view transactions" ON public.transactions IS
  'Wallet rows for members; plus user-scoped incomes (not income_scope=wallet) for self or co-members of any shared split wallet.';
