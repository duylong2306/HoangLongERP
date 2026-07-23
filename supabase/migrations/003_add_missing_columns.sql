-- Migration: Add department_code to hrm_performance_criteria
ALTER TABLE hrm_performance_criteria
ADD COLUMN IF NOT EXISTS department_code TEXT;

-- Migration: Add bank_name column to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name TEXT;