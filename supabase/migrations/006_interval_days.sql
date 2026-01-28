-- Every x days recurrence
ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS interval_days INT CHECK (
    interval_days IS NULL OR interval_days > 0
  );

ALTER TABLE recurring_rules
  DROP CONSTRAINT IF EXISTS recurring_rules_recurrence_type_check;
ALTER TABLE recurring_rules
  ADD CONSTRAINT recurring_rules_recurrence_type_check CHECK (
    recurrence_type IN (
      'daily',
      'weekly',
      'monthly',
      'yearly',
      'interval_days',
      'interval_months',
      'monthly_nth_work_day',
      'monthly_nth_last_work_day'
    )
  );
