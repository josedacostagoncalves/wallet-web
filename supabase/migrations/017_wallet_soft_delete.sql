-- Soft-delete support for wallets.
-- deleted_at: when the user requested deletion (NULL = not deleted).
-- delete_after: hard-delete deadline (30 days after deleted_at). A cron/job can
--               permanently remove rows where delete_after < now().
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ DEFAULT NULL;

-- Allow wallet owners to delete their wallets.
CREATE POLICY "Owners can delete their wallets"
  ON public.wallets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM wallet_members wm
      WHERE wm.wallet_id = wallets.id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );
