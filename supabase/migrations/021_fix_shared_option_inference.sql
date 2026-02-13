-- Fix shared_option for wallets that have split_type set but shared_option is NULL
-- This ensures backwards compatibility for wallets created before proper shared_option tracking

UPDATE public.wallets
SET shared_option = 'split'
WHERE is_shared = true AND shared_option IS NULL AND split_type IS NOT NULL;

-- Comment on the fix
COMMENT ON TABLE public.wallets IS 'Wallets table. shared_option: track (account tracking only), split (expense splitting only), track_and_split (both features)';
