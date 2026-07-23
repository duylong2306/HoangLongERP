-- Migration: Add bank_account column to employees (renamed to bank_name for clarity)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name TEXT;