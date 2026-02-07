-- When a movement is pending, hold_balance controls whether balances were already updated.
-- hold_balance = true  => balances NOT updated yet (wait until confirm)
-- hold_balance = false => balances already updated on creation (default for confirmed, and for pending that chose to update immediately)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS hold_balance BOOLEAN NOT NULL DEFAULT false;
