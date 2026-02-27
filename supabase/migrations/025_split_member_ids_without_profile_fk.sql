-- Allow split members that are not authenticated users/profiles.
-- We keep UUID member IDs, but remove strict FK coupling to auth/profile rows.

ALTER TABLE public.wallet_members
DROP CONSTRAINT IF EXISTS wallet_members_user_id_fkey;

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS fk_transactions_paid_by_member;

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_received_by_member_id_fkey;

ALTER TABLE public.transaction_splits
DROP CONSTRAINT IF EXISTS transaction_splits_member_id_fkey;

