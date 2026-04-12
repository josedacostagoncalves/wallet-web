-- Essential flag: meaningful on subcategories and on top-level categories with no children.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_essential BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN categories.is_essential IS 'Expense-only budget flag. For parents with subcategories, should stay false; cleared when first expense subcategory is added.';
