-- =============================================================================
-- Migration: Dọn dữ liệu Công tác phí bị nhân bản (hrm_travel_expenses)
-- -----------------------------------------------------------------------------
-- Bối cảnh: Bảng Công tác phí bị nhân bản do 2 lỗi cũ trong TaskDetailModal:
--   1. Nút "Xóa CTP" chỉ xóa khỏi nhiệm vụ (missions) + localStorage, KHÔNG xóa
--      dòng tương ứng trong hrm_travel_expenses → để lại "pending mồ côi".
--   2. Thêm CTP trên nhiệm vụ đã hoàn thành tạo dòng pending vĩnh viễn (luồng
--      "Xác Nhận Hoàn Thành" không chạy lại để upsert lên completed).
--   3. Nhiệm vụ bị "Hoàn thành" 2 lần → gửi CTP completed 2 đợt trùng nhau.
--
-- Migration này chỉ dọn ĐÚNG các dòng đã xác minh là nhân bản/mồ côi trên
-- database thật (2026-08-11), giữ nguyên các dòng hợp lệ. Idempotent.
-- =============================================================================

-- ── 1. Xóa các "pending mồ côi": không nằm trong bất kỳ missions.travelAllowances nào ──
-- Những dòng này được persist lúc "Thêm CTP" nhưng không bao giờ được hoàn thành
-- (bị xóa khỏi nhiệm vụ mà không xóa khỏi bảng, hoặc bỏ dở giữa chừng).
DELETE FROM public.hrm_travel_expenses
WHERE id IN (
  '35b41e5b-8895-4f2c-b22b-f57a309f2505',  -- ta_1785716502208 (pending mồ côi)
  '203d3a5e-eecc-4849-967e-17a16823ab2f',  -- ta_1785750720126 (pending mồ côi)
  '4393875c-c4e5-44f3-84ec-6739986a1042'   -- ta_1786182783703 (pending mồ côi)
);

-- ── 2. Xóa nhóm "completed trùng lặp" 07/08 09:54 (THCTP-027..030) ──
-- Cùng mission "Hoàn thiện lan can, tấm đan mương nước Canteen HVLQ", cùng
-- employeeName + content với nhóm THCTP-031..034 (10:16) — là lần "Hoàn thành"
-- đầu tiên của cùng nhiệm vụ, không còn được tham chiếu trong tasks.missions.
DELETE FROM public.hrm_travel_expenses
WHERE id IN (
  'cbf47285-b862-4f2c-a7ec-2b97b4249fee',  -- THCTP-027 (Lê Văn Công — Nghỉ qua đêm)
  '5e6bd8a8-856c-4d56-a4c4-ad22bddd9783',  -- THCTP-028 (Nguyễn Ngọc Sơn — Đi xe 1 người)
  '3d1905a6-526a-44b1-b761-fa2dd05f5e6a',  -- THCTP-029 (Nhữ Văn Phường — Nghỉ qua đêm)
  '554c9010-c37a-44c9-a5ee-3cb08e26d554'   -- THCTP-030 (Nguyễn Trần Nghĩa — Nghỉ qua đêm)
);
