-- Work day recurrence: nth work day / nth last work day of month
ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS work_day_index INT CHECK (
    work_day_index IS NULL OR (work_day_index >= 1 AND work_day_index <= 31)
  );

-- Extend recurrence_type to allow work-day variants
ALTER TABLE recurring_rules
  DROP CONSTRAINT IF EXISTS recurring_rules_recurrence_type_check;
ALTER TABLE recurring_rules
  ADD CONSTRAINT recurring_rules_recurrence_type_check CHECK (
    recurrence_type IN (
      'daily',
      'weekly',
      'monthly',
      'interval_months',
      'yearly',
      'monthly_nth_work_day',
      'monthly_nth_last_work_day'
    )
  );
