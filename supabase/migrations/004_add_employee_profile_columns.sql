-- =====================================================================
-- Migration: Thêm các cột thiếu cho bảng employees
-- Phù hợp với EmployeeProfile interface (hrTypes.ts)
-- và export Excel "Hồ Sơ Nhân Viên" (HumanResourcesManagement.tsx)
-- =====================================================================
-- Các cột đã có sẵn: id, name, email, phone, department, username,
--   password, avatar, address, role, bank_account, bank_name

-- 1. Thông tin cá nhân
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Nam';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cccd TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cccd_issued_date TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cccd_issued_place TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_address TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT DEFAULT '';

-- 2. Thông tin công việc
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Thử việc 02 tháng';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_code TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phep_nam INTEGER DEFAULT 12;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'working';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS docs_count INTEGER DEFAULT 0;

-- 3. BHXH & Thuế
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bhxh_book_no TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bhxh_salary NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bhxh_rate NUMERIC DEFAULT 10.5;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bhxh_date TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_personal_relief NUMERIC DEFAULT 15500000;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dependent_count INTEGER DEFAULT 0;

-- 4. Tài khoản hệ thống
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_system_account BOOLEAN DEFAULT false;

-- 5. Phân quyền (roleGroupIds là string[] → lưu JSONB)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_group_ids JSONB DEFAULT '[]'::jsonb;

-- =====================================================================
-- HOÀN THÀNH!
-- Bảng employees giờ đã có đầy đủ các cột cho EmployeeProfile
-- =====================================================================
