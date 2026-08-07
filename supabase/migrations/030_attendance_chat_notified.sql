-- =============================================================================
-- Migration 030: Nhóm chat "Điểm danh" — claim "người chấm đầu tiên" (atomic)
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Mục đích:
--   Khi nhiều nhân viên cùng chấm công sát nhau, CHỈ người chấm ĐẦU TIÊN cho
--   mỗi slot trong ngày mới được gửi tin nhắc vào nhóm chat "Điểm danh"
--   (conv_attendance). Việc chọn người đầu tiên phải làm ở tầng database
--   (INSERT ... ON CONFLICT DO NOTHING) để chống race condition giữa các client.
--
-- Cơ chế:
--   1) Bảng attendance_chat_notified đánh dấu (date, slot) đã được gửi tin bởi ai.
--   2) RPC claim_attendance_chat(p_date, p_slot, p_emp_id):
--      - Bỏ qua nếu là NGÀY NGHỈ (weekend_days từ shift_config + hrm_holidays,
--        tái dùng logic migration 007).
--      - Ngược lại INSERT ... ON CONFLICT (date, slot) DO NOTHING RETURNING *;
--        Chỉ request trả về 1 row (đúng người chấm đầu tiên) mới đủ điều kiện gửi tin.
--   3) RLS: bật RLS trên attendance_chat_notified KHÔNG có policy → anon không thể
--      tự chèn/đọc bảng trực tiếp, chỉ gọi được qua RPC (SECURITY DEFINER).
-- =============================================================================

-- ─── BƯỚC 1: Bảng đánh dấu đã gửi tin theo (date, slot) ────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_chat_notified (
  date        text NOT NULL,   -- 'YYYY-MM-DD'
  slot        text NOT NULL,   -- timeInS / timeOutS / timeInC / timeOutC
  notified_by text NOT NULL,   -- empId của người chấm đầu tiên
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, slot)
);

-- Chặn anon truy cập trực tiếp bảng (chỉ qua RPC claim_attendance_chat)
ALTER TABLE public.attendance_chat_notified ENABLE ROW LEVEL SECURITY;
-- Không tạo policy nào → mọi role ngoài chủ bảng đều bị chặn đọc/ghi trực tiếp.

-- ─── BƯỚC 2: RPC claim "người chấm đầu tiên" (server-side atomic) ──────────
CREATE OR REPLACE FUNCTION claim_attendance_chat(
  p_date   text,
  p_slot   text,
  p_emp_id text
)
RETURNS SETOF public.attendance_chat_notified
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weekend integer[];
  v_day_of_week int;
  v_date_ddmm text;
  v_date_ddmmyyyy text;
BEGIN
  -- ─── Kiểm tra NGÀY NGHỈ (tái dùng logic migration 007) ───
  -- 1) Ngày nghỉ cuối tuần cấu hình trong tab "Cấu hình ca"
  BEGIN
    SELECT weekend_days INTO v_weekend FROM shift_config WHERE id = 'current';
  EXCEPTION WHEN OTHERS THEN
    v_weekend := NULL;
  END;

  IF v_weekend IS NULL OR array_length(v_weekend, 1) IS NULL THEN
    v_weekend := ARRAY[0]; -- mặc định chỉ Chủ nhật
  END IF;

  -- Tính day-of-week theo chính p_date (0=CN ... 6=T7), không dựa vào now()
  v_day_of_week := extract(dow from p_date::date)::int;
  IF v_day_of_week = ANY(v_weekend) THEN
    RAISE NOTICE 'Ngày nghỉ cuối tuần (dow=%) - bỏ qua tin nhóm Điểm danh', v_day_of_week;
    RETURN; -- không trả row nào → client không gửi tin
  END IF;

  -- 2) Ngày lễ từ bảng hrm_holidays (khớp cả DD/MM và DD/MM/YYYY)
  v_date_ddmm     := to_char(p_date::date, 'DD/MM');
  v_date_ddmmyyyy := to_char(p_date::date, 'DD/MM/YYYY');

  IF EXISTS (
    SELECT 1 FROM hrm_holidays
    WHERE date = v_date_ddmm OR date = v_date_ddmmyyyy
  ) THEN
    RAISE NOTICE 'Ngày lễ % - bỏ qua tin nhóm Điểm danh', v_date_ddmmyyyy;
    RETURN; -- không trả row nào → client không gửi tin
  END IF;

  -- ─── Claim: INSERT ... ON CONFLICT DO NOTHING RETURNING * ───
  -- Nếu (date, slot) đã có người claim trước → ON CONFLICT DO NOTHING, không trả row.
  -- Nếu đây là người ĐẦU TIÊN → INSERT thành công và RETURNING trả về đúng 1 row.
  RETURN QUERY
    INSERT INTO public.attendance_chat_notified (date, slot, notified_by)
    VALUES (p_date, p_slot, p_emp_id)
    ON CONFLICT (date, slot) DO NOTHING
    RETURNING *;
END;
$$;

-- ─── BƯỚC 3: Grant quyền thực thi cho anon + authenticated (app dùng anon key) ──
GRANT EXECUTE ON FUNCTION claim_attendance_chat(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION claim_attendance_chat(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_attendance_chat(text, text, text) TO service_role;

-- =============================================================================
-- TEST (chạy thủ công trong SQL Editor):
--   SELECT * FROM claim_attendance_chat('2026-08-07', 'timeInS', 'EMP-1');
--   SELECT * FROM claim_attendance_chat('2026-08-07', 'timeInS', 'EMP-2');  -- không trả row
--   SELECT * FROM attendance_chat_notified;
-- =============================================================================
