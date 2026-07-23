-- Migration: Add bank_account column to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_account TEXT;