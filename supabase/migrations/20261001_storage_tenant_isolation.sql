-- ============================================================================
-- Giai đoạn 8 (Multi-tenant): siết RLS cho Supabase Storage theo company_id
-- ============================================================================
-- RÀ SOÁT BẢO MẬT 2026-10-01: 5 bucket ảnh (avatars, attendance-photos,
-- mission-report-images, quote-images, product-catalog-images) được tạo
-- public = true với policy select/insert/update/delete chỉ kiểm tra
-- bucket_id — KHÔNG hề kiểm tra company_id. Xác nhận bằng thực nghiệm: gọi
-- endpoint LIST (POST /storage/v1/object/list/<bucket>) CHỈ bằng anon key
-- công khai (không cần đăng nhập, không cần JWT công ty nào) vẫn trả về
-- 200 OK — bất kỳ ai biết anon key (vốn lộ sẵn trong mọi bundle JS frontend)
-- đều liệt kê + tải được TOÀN BỘ ảnh của MỌI công ty, kể cả ảnh chấm công
-- sinh trắc khuôn mặt (attendance-photos) — không phân biệt company_id.
--
-- Đây độc lập với RLS các bảng database (đã đúng, xem 20260928c) — Storage
-- objects có RLS riêng, chưa từng được siết theo company_id.
--
-- SỬA 2 LỚP:
-- 1) Đường dẫn file (xem dbService.ts: uploadMissionReportImage,
--    uploadProductImage, uploadQuoteImage, uploadAttendancePhoto,
--    uploadAvatar) nay gắn company_id làm THƯ MỤC GỐC — ví dụ
--    "<company_id>/task_x/mission_y_169...jpg" thay vì "task_x/mission_y_...".
-- 2) Migration này: policy storage.objects cho 5 bucket trên đổi từ "cho
--    PUBLIC đọc/ghi miễn đúng bucket_id" → "chỉ authenticated, VÀ thư mục
--    gốc của đường dẫn (storage.foldername(name))[1] phải khớp company_id
--    trong JWT" — y hệt nguyên tắc tenant_isolation đã áp cho mọi bảng DB.
--
-- GIỚI HẠN CÒN LẠI (không thể đóng hoàn toàn bằng RLS): bucket vẫn giữ
-- public = true để endpoint GET /storage/v1/object/public/<bucket>/<path>
-- (dùng bởi getPublicUrl(), nơi toàn bộ UI hiển thị ảnh) tiếp tục hoạt động
-- không cần đổi code. Endpoint public GET này tự thiết kế BỎ QUA RLS khi
-- bucket.public = true — ai biết CHÍNH XÁC URL file vẫn tải được file đó mà
-- không cần đăng nhập. Migration này KHÔNG xoá được rủi ro đó (muốn xoá hẳn
-- phải chuyển bucket sang private + ký URL tạm thời, đổi toàn bộ luồng hiển
-- thị ảnh — phạm vi lớn hơn, cần bàn riêng). Điều migration này xoá được là
-- rủi ro ĐÃ CHỨNG MINH: liệt kê/dò toàn bộ ảnh của MỌI công ty mà không cần
-- biết trước bất kỳ URL nào — rủi ro lớn nhất trong 2 cái.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent.
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
    -- Tên policy cũ khác nhau theo từng migration gốc (avatars_select,
    -- attendance_photos_select, ...) — suy ra tiền tố từ tên bucket (thay
    -- dấu gạch ngang bằng gạch dưới) để DROP đúng policy cũ của bucket đó.
    prefix := replace(bucket_name, '-', '_');

    execute format('drop policy if exists %I on storage.objects;', prefix || '_select');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_insert');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_update');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_delete');
    -- Tên cũ nhất quán toàn migration mới — drop luôn phòng khi chạy lại.
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_select');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_insert');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_update');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_delete');

    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_select', bucket_name
    );
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_insert', bucket_name
    );
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''))
         with check (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_update', bucket_name, bucket_name
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_delete', bucket_name
    );

    raise notice '✅ Đã siết RLS theo company_id cho bucket: %', bucket_name;
  end loop;
end $$;

-- ============================================================================
-- KIỂM TRA SAU KHI CHẠY:
--
-- 1) Xác nhận LIST công khai (không JWT) đã bị chặn — kỳ vọng lỗi 400/403,
--    KHÔNG còn trả 200 kèm mảng JSON:
--      curl -X POST 'https://<project>.supabase.co/storage/v1/object/list/avatars' \
--        -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>" \
--        -H "Content-Type: application/json" -d '{"prefix":"","limit":20}'
--
-- 2) Đăng nhập app bình thường, thử Thêm nhân viên mới + tải avatar, chấm
--    công (ảnh selfie), tải ảnh sản phẩm/báo giá/báo cáo công tác — mọi
--    luồng upload hiện có phải vẫn chạy được bình thường (code đã gắn
--    company_id vào path trước khi migration này chạy).
-- ============================================================================
