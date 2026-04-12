-- Optional free-text notes per transaction
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS observations text;

-- File metadata (blobs in storage bucket transaction-files)
CREATE TABLE IF NOT EXISTS public.transaction_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_attachments_tx
  ON public.transaction_attachments(transaction_id);

ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view transaction attachments" ON public.transaction_attachments;
CREATE POLICY "Members can view transaction attachments"
  ON public.transaction_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_attachments.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can insert transaction attachments" ON public.transaction_attachments;
CREATE POLICY "Members can insert transaction attachments"
  ON public.transaction_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_attachments.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Members can delete transaction attachments" ON public.transaction_attachments;
CREATE POLICY "Members can delete transaction attachments"
  ON public.transaction_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_attachments.transaction_id
        AND is_wallet_member(t.wallet_id, auth.uid())
    )
  );

-- Private bucket: path layout wallet_id / transaction_id / filename
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-files', 'transaction-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Wallet members insert transaction-files" ON storage.objects;
CREATE POLICY "Wallet members insert transaction-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-files'
    AND is_wallet_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Wallet members select transaction-files" ON storage.objects;
CREATE POLICY "Wallet members select transaction-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-files'
    AND is_wallet_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Wallet members delete transaction-files" ON storage.objects;
CREATE POLICY "Wallet members delete transaction-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-files'
    AND is_wallet_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
