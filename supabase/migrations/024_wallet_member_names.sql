-- Support manual member names (without mandatory email) for split wallets.

ALTER TABLE public.wallet_members
ADD COLUMN IF NOT EXISTS member_name TEXT;

COMMENT ON COLUMN public.wallet_members.member_name IS
'Optional display name for wallet members. Used when member has no profile name/email.';

