-- Optional end date for recurring rules
ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS end_date DATE NULL;

-- Day of week for weekly (0 = Sunday .. 6 = Saturday)
ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS weekday INT NULL;
ALTER TABLE recurring_rules
  DROP CONSTRAINT IF EXISTS recurring_rules_weekday_check;
ALTER TABLE recurring_rules
  ADD CONSTRAINT recurring_rules_weekday_check
  CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6));

-- Day of month for monthly (1–31)
ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS day_of_month INT NULL;
ALTER TABLE recurring_rules
  DROP CONSTRAINT IF EXISTS recurring_rules_day_of_month_check;
ALTER TABLE recurring_rules
  ADD CONSTRAINT recurring_rules_day_of_month_check
  CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31));
