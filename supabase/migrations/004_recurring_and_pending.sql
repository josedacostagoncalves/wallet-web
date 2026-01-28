-- Recurring rules: template for auto-generated movements
CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  account_from_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  account_to_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'interval_months', 'yearly')),
  interval_months INT CHECK (interval_months IS NULL OR interval_months > 0),
  anchor_date DATE NOT NULL,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_rules_wallet ON recurring_rules(wallet_id);
CREATE INDEX idx_recurring_rules_next_run ON recurring_rules(wallet_id, next_run_date) WHERE is_active = true;

-- Transactions: status (confirmed vs pending) and optional link to recurring rule
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending')),
  ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES recurring_rules(id) ON DELETE SET NULL;

-- Backfill existing rows (if any) to confirmed
UPDATE transactions SET status = 'confirmed' WHERE status IS NULL;

CREATE INDEX idx_transactions_status ON transactions(wallet_id, status);

-- RLS: recurring_rules
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view recurring_rules of their wallets"
  ON recurring_rules FOR SELECT
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can insert recurring_rules"
  ON recurring_rules FOR INSERT
  WITH CHECK (is_wallet_member(wallet_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Members can update recurring_rules"
  ON recurring_rules FOR UPDATE
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can delete recurring_rules"
  ON recurring_rules FOR DELETE
  USING (is_wallet_member(wallet_id, auth.uid()));

-- Trigger: updated_at for recurring_rules
CREATE TRIGGER recurring_rules_updated_at
  BEFORE UPDATE ON recurring_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
