-- Account type: Bank Account, Cash, Credit Card, Savings, Investments
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'bank_account'
    CHECK (account_type IN (
      'bank_account',
      'cash',
      'credit_card',
      'savings',
      'investments'
    ));

-- Backfill existing rows (default already applied; ensure none are null)
UPDATE accounts SET account_type = 'bank_account' WHERE account_type IS NULL;
