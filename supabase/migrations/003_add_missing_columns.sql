-- Migration: Fix hrm_performance_criteria schema to match code expectations
-- The code uses string IDs (e.g., 'dept_all') but Supabase expects UUID
-- This migration converts the id column from UUID to TEXT

ALTER TABLE hrm_performance_criteria
ALTER COLUMN id TYPE TEXT;

-- Add missing department_code column if not exists
ALTER TABLE hrm_performance_criteria
ADD COLUMN IF NOT EXISTS department_code TEXT;