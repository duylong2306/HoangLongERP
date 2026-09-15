-- =============================================================================
-- Migration 20260821b: Don anh base64 trong DB -> chuyen sang Storage
-- =============================================================================
-- Boi canh: khi bucket chua duoc tao, app fallback luu anh dang base64
-- (data:image/...) thang vao DB (tasks.missions, quotes.items, payments.images,
-- attendance_records.photo_in/out...). 1 anh dien thoai ~2-5MB -> moi dong co
-- the nang vai MB. Moi lan refetch full bang (realtime/polling) la tai lai
-- toan bo so MB do x so tab dang mo -> nguyen nhan chinh gay can EGRESS.
--
-- Code hien tai DA upload len Storage bucket va chi fallback base64 khi loi
-- (dbService.uploadMissionReportImage / uploadQuoteImage / uploadProductImage /
-- migration 029 attendance-photos). Viec can lam:
--   1. Dam bao cac bucket ton tai (chay migration 020, 025, 029, 034 neu chua).
--   2. QUET xem con bao nhieu dong chua base64 (Phan 2).
--   3. Quyet dinh don dep — XEM PHAN 3 truoc khi chay Phan 4.
-- =============================================================================

-- PHAN 1: KIEM TRA BUCKET DA TON TAI
SELECT id, name, public, file_size_limit, created_at
FROM storage.buckets
ORDER BY id;

-- PHAN 2: DEM DONG CHUA BASE64 THEO BANG/COT (chi doc, an toan)
SELECT 'tasks.missions' AS location,
       count(*) FILTER (WHERE missions::text LIKE '%data:image%') AS base64_rows,
       pg_size_pretty(sum(length(missions::text))::bigint) AS total_col_size
FROM public.tasks
UNION ALL
SELECT 'tasks.comments',
       count(*) FILTER (WHERE comments::text LIKE '%data:image%'),
       pg_size_pretty(sum(length(comments::text))::bigint)
FROM public.tasks
UNION ALL
SELECT 'payments.images',
       count(*) FILTER (WHERE images::text LIKE '%data:image%'),
       pg_size_pretty(sum(length(images::text))::bigint)
FROM public.payments
UNION ALL
SELECT 'quotes.items',
       count(*) FILTER (WHERE items::text LIKE '%data:image%'),
       pg_size_pretty(sum(length(items::text))::bigint)
FROM public.quotes
UNION ALL
SELECT 'attendance_records.photo_in',
       count(*) FILTER (WHERE photo_in LIKE '%data:image%'),
       pg_size_pretty(sum(length(COALESCE(photo_in,'')))::bigint)
FROM public.attendance_records
UNION ALL
SELECT 'attendance_records.photo_out',
       count(*) FILTER (WHERE photo_out LIKE '%data:image%'),
       pg_size_pretty(sum(length(COALESCE(photo_out,'')))::bigint)
FROM public.attendance_records;

-- PHAN 3: DOC KET QUA PHAN 2 TRUOC KHI LAM TIEP
-- (a) It dong (< 20) & anh cu khong con gia tri phap ly -> chay PHAN 4.
-- (b) Nhieu dong & van can anh -> can script Node mot lan: doc tung dong,
--     decode base64, upload len Storage bucket tuong ung, thay bang public URL.
--     Yeu cau Claude viet script nay khi da co so lieu tu Phan 2.
-- (c) attendance_records.photo_*: migration 029 da chuyen luong moi sang
--     bucket attendance-photos. Neu Phan 2 cho thay photo_in/out van con
--     nhieu base64 -> do la du lieu cu; xu ly nhu (a) hoac (b).

-- PHAN 4: XOA CHUOI BASE64 KHOI attendance_records (du lieu cham cong cu).
-- !! KHONG THE HOAN TAC — backup bang truoc khi chay:
--    Table Editor -> attendance_records -> Export CSV (hoac pg_dump).
UPDATE public.attendance_records
SET photo_in = ''
WHERE photo_in LIKE '%data:image%';

UPDATE public.attendance_records
SET photo_out = ''
WHERE photo_out LIKE '%data:image%';

-- Sau khi chay: VACUUM de thu hoi dung luong (chay rieng trong SQL Editor):
--   VACUUM FULL ANALYZE public.attendance_records;
-- (VACUUM FULL khoa bang vai giay -> chay ngoai gio hanh chinh.)

-- PHAN 5: VERIFY SAU DON
SELECT count(*) FILTER (WHERE photo_in LIKE '%data:image%' OR photo_out LIKE '%data:image%') AS remaining_base64_rows,
       pg_size_pretty(pg_total_relation_size('public.attendance_records')) AS table_size_after
FROM public.attendance_records;
