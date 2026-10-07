-- ============================================================================
-- ⚠️ CHỈ CHẠY TRÊN PROJECT PRODUCTION (cyuunmrdrymhzxfcruoe) — KHÔNG chạy trên
-- project staging multi-tenant (oittwcngarzmtrmjxisu). Staging đã có migration
-- riêng theo company_id: 20261001_storage_tenant_isolation.sql.
-- ============================================================================
--
-- RÀ SOÁT BẢO MẬT 2026-10-01: production (nhánh main) KHÔNG có api/login.ts,
-- KHÔNG ký JWT nào — toàn bộ app chạy bằng 1 anon key công khai duy nhất
-- (xác thực nhân viên chỉ ở tầng ứng dụng qua bảng employees, không dùng
-- Supabase Auth). 5 bucket ảnh (avatars, attendance-photos,
-- mission-report-images, quote-images, product-catalog-images) có policy
-- select CHO PHÉP BẤT KỲ AI (kể cả không mở app, không biết ERP là gì) liệt
-- kê toàn bộ file qua POST /storage/v1/object/list/<bucket> chỉ bằng anon
-- key (lộ sẵn trong bundle JS công khai của trang web) — không cần đăng
-- nhập gì cả.
--
-- XÁC NHẬN BẰNG THỰC NGHIỆM (chỉ đọc, không sửa/xoá gì) — cả 5 bucket đều có
-- dữ liệu thật:
--   avatars/                 → NV013, NV020, NV023... (avatar nhân viên thật)
--   attendance-photos/       → attendance/... (ảnh chấm công sinh trắc khuôn mặt)
--   mission-report-images/   → task_auto_.../ (ảnh báo cáo công tác thật)
--   quote-images/            → quotes/... (ảnh báo giá thật)
--   product-catalog-images/  → (ảnh sản phẩm thật)
--
-- Vì production KHÔNG có JWT/company_id (khác staging), không thể dùng điều
-- kiện "company_id khớp JWT" như migration tenant_isolation. Thay vào đó:
-- XOÁ HẲN quyền SELECT/LIST công khai qua REST Storage API — không tạo lại
-- policy select nào.
--
-- TẠI SAO ẢNH VẪN HIỂN THỊ BÌNH THƯỜNG TRONG APP SAU KHI CHẠY MIGRATION NÀY:
-- toàn bộ UI hiển thị ảnh (avatar, ảnh chấm công, ảnh báo giá...) dùng
-- getPublicUrl() → trỏ tới endpoint GET /storage/v1/object/public/<bucket>/
-- <path>, một endpoint RIÊNG của Supabase Storage dành cho bucket có
-- public = true, TỰ ĐỘNG bỏ qua RLS/policy của storage.objects theo thiết
-- kế — không bị ảnh hưởng bởi việc xoá policy select ở đây. Chỉ LIST
-- (liệt kê toàn bộ) và GET không qua đường public (dùng xác thực) mới bị
-- chặn — đúng mục tiêu: đóng việc "dò ra toàn bộ danh sách file" mà không
-- cần biết trước bất kỳ đường dẫn nào.
--
-- GIỚI HẠN CÒN LẠI (không đóng được bằng cách này — cần đổi kiến trúc lớn
-- hơn, bàn riêng nếu muốn xử lý tiếp): ai ĐÃ BIẾT CHÍNH XÁC 1 URL ảnh cụ thể
-- (ví dụ do URL đó từng xuất hiện ở đâu đó ngoài tầm kiểm soát) vẫn tải được
-- đúng ảnh đó — đây là giới hạn vốn có của "public bucket", chỉ xoá hẳn
-- được bằng cách chuyển sang bucket private + ký URL tạm thời (signed URL),
-- đổi toàn bộ luồng hiển thị ảnh trong code.
--
-- INSERT/UPDATE/DELETE giữ nguyên "to anon, authenticated" như cũ — KHÔNG
-- đổi, vì production chưa có khái niệm company để phân biệt ai được sửa/xoá
-- ảnh của ai; nhân viên nội bộ vốn đã được app tin cậy ở tầng ứng dụng.
--
-- ⚠️ ĐIỀU KIỆN BẮT BUỘC TRƯỚC KHI CHẠY (kiểm chứng thực tế trên staging 2026-10-07, bucket thử
-- tạm chỉ có insert/update/delete, KHÔNG có select — đúng trạng thái production sau migration này):
--   • upload với upsert:false      → OK (200)
--   • upload với upsert:true       → LỖI 403 "new row violates row-level security policy"
--     (Supabase Storage cần quyền SELECT cho upsert, kể cả file mới)
--   • LIST công khai               → bị chặn (trả mảng rỗng)
--   • GET qua URL công khai        → vẫn OK (200)
--   • DELETE                       → 403 (app không xóa file ảnh nên không ảnh hưởng)
-- ⇒ PHẢI deploy bản code đã đổi 4 chỗ upload (dbService.ts) từ upsert:true sang upsert:false
--   TRƯỚC khi chạy migration này, nếu không tải avatar/ảnh sản phẩm/ảnh báo giá/ảnh báo cáo
--   công tác lên sẽ lỗi. Người đang mở app bản cũ cần tải lại trang (F5) sau khi deploy.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor (project PRODUCTION).
-- Idempotent — chạy lại không lỗi.
-- ============================================================================

do $$
declare
  bucket_name text;
  buckets text[] := array[
    'avatars',
    'attendance-photos',
    'mission-report-images',
    'quote-images',
    'product-catalog-images'
  ];
  prefix text;
begin
  foreach bucket_name in array buckets loop
    prefix := replace(bucket_name, '-', '_');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_select');
    raise notice '🔒 Đã xoá quyền LIST/SELECT công khai cho bucket: %', bucket_name;
  end loop;
end $$;

-- ============================================================================
-- KIỂM TRA SAU KHI CHẠY:
--
-- 1) LIST công khai phải bị chặn (kỳ vọng lỗi, KHÔNG còn trả mảng JSON):
--      curl -s -X POST 'https://cyuunmrdrymhzxfcruoe.supabase.co/storage/v1/object/list/avatars' \
--        -H "apikey: <anon-key-production>" -H "Authorization: Bearer <anon-key-production>" \
--        -H "Content-Type: application/json" -d '{"prefix":"","limit":5}'
--
-- 2) Mở app production thật, xác nhận avatar nhân viên / ảnh chấm công /
--    ảnh báo giá / ảnh sản phẩm vẫn hiển thị ĐÚNG như trước (vì đi qua
--    endpoint public riêng, không phụ thuộc policy select vừa xoá).
--
-- 3) Thử tải lên 1 avatar/ảnh mới — phải vẫn thành công bình thường (insert
--    policy không đổi).
-- ============================================================================
