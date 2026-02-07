-- Add plafond (credit limit) to accounts, nullable. Only relevant for credit_card type.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS plafond NUMERIC DEFAULT NULL;
