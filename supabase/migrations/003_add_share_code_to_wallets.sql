-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add share_code column to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS share_code TEXT;

-- Create index on share_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_share_code ON wallets(share_code) WHERE share_code IS NOT NULL;
