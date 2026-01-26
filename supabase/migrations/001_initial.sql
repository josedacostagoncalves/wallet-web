-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet members (for shared wallets)
CREATE TABLE wallet_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, user_id)
);

-- Accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories (Level 2 = parent_id null, Level 3 = parent_id set)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions (movements)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  account_from_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  account_to_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_wallet_members_wallet ON wallet_members(wallet_id);
CREATE INDEX idx_wallet_members_user ON wallet_members(user_id);
CREATE INDEX idx_accounts_wallet ON accounts(wallet_id);
CREATE INDEX idx_categories_wallet ON categories(wallet_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_type ON categories(wallet_id, type);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_date ON transactions(wallet_id, date DESC);
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_wallet ON activity_log(wallet_id, created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- RLS: helper to check if user is member of a wallet
CREATE OR REPLACE FUNCTION is_wallet_member(w_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM wallet_members WHERE wallet_id = w_id AND user_id = u_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: wallets
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view wallets they are members of"
  ON wallets FOR SELECT
  USING (is_wallet_member(id, auth.uid()));
CREATE POLICY "Users can insert wallets (becoming owner)"
  ON wallets FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update their wallets"
  ON wallets FOR UPDATE
  USING (is_wallet_member(id, auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM wallet_members wm WHERE wm.wallet_id = wallets.id AND wm.user_id = auth.uid() AND wm.role = 'owner'));

-- RLS: wallet_members
ALTER TABLE wallet_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view wallet_members of their wallets"
  ON wallet_members FOR SELECT
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Creator or owners can insert wallet_members"
  ON wallet_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM wallets w WHERE w.id = wallet_members.wallet_id AND w.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM wallet_members wm WHERE wm.wallet_id = wallet_members.wallet_id AND wm.user_id = auth.uid() AND wm.role = 'owner')
  );
CREATE POLICY "Owners can delete other members; users can leave"
  ON wallet_members FOR DELETE
  USING (
    is_wallet_member(wallet_id, auth.uid())
    AND (auth.uid() = user_id OR EXISTS (SELECT 1 FROM wallet_members wm WHERE wm.wallet_id = wallet_members.wallet_id AND wm.user_id = auth.uid() AND wm.role = 'owner'))
  );

-- RLS: accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view accounts"
  ON accounts FOR SELECT
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can insert accounts"
  ON accounts FOR INSERT
  WITH CHECK (is_wallet_member(wallet_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Members can update accounts"
  ON accounts FOR UPDATE
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can delete accounts"
  ON accounts FOR DELETE
  USING (is_wallet_member(wallet_id, auth.uid()));

-- RLS: categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view categories"
  ON categories FOR SELECT
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can insert categories"
  ON categories FOR INSERT
  WITH CHECK (is_wallet_member(wallet_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Members can update categories"
  ON categories FOR UPDATE
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can delete categories"
  ON categories FOR DELETE
  USING (is_wallet_member(wallet_id, auth.uid()));

-- RLS: transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view transactions"
  ON transactions FOR SELECT
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can update transactions"
  ON transactions FOR UPDATE
  USING (is_wallet_member(wallet_id, auth.uid()));
CREATE POLICY "Members can delete transactions"
  ON transactions FOR DELETE
  USING (is_wallet_member(wallet_id, auth.uid()));

-- RLS: activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own auth events or wallet activity"
  ON activity_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR (wallet_id IS NOT NULL AND is_wallet_member(wallet_id, auth.uid()))
  );
CREATE POLICY "Authenticated users can insert their own activity"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE on activity_log for normal users.

-- Trigger: updated_at for wallets, accounts, categories
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
