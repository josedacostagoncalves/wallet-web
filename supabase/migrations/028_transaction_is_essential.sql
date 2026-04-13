-- Per-transaction override for expense "essential" flag. NULL = inherit from category leaf.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_essential BOOLEAN NULL;

COMMENT ON COLUMN transactions.is_essential IS 'Expense only: NULL inherits from category/subcategory is_essential; true/false overrides for this transaction.';
