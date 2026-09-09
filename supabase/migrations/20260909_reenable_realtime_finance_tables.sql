-- ============================================================================
-- Migration: Bật LẠI Realtime (server-side) cho 4 bảng Tài Chính - Kế Toán
--
-- LÝ DO: Migration 20260826d đã gỡ 21 bảng "ít đổi" khỏi Realtime (kèm gỡ khỏi
-- publication supabase_realtime) vì tài khoản Supabase vượt hạn mức "Tin nhắn
-- thời gian thực" (117%/tháng). Nay chủ dự án yêu cầu các tab Công Nợ Thu,
-- Công Nợ Trả, Quỹ Tiền Mặt trong Tài Chính - Kế Toán phải cập nhật tức thời
-- (tránh nhiều người thao tác lại gây trùng số liệu) — nên bật lại Realtime
-- CHỈ 4 bảng cốt lõi của các tab đó, KHÔNG bật lại cả 21 bảng đã gỡ, để giảm
-- rủi ro lặp lại sự cố vượt hạn mức:
--   - accounting_liabilities   (Công Nợ Trả)
--   - accounting_receivables   (Công Nợ Thu)
--   - accounting_sub_contracts (Công Nợ Trả — giá trị hợp đồng thầu phụ)
--   - cash_fund_config         (Quỹ Tiền Mặt — số dư đầu kỳ)
--
-- 3 tab còn lại người dùng yêu cầu (Đề Xuất Chi, Đơn Hàng, Nhập Thu, Nhập Chi)
-- đã Realtime sẵn từ trước (subcontractor_advances, purchase_orders, receipts,
-- payments, customers) — KHÔNG cần đụng tới ở migration này.
--
-- CẢNH BÁO: chạy migration này TĂNG lượng "Tin nhắn thời gian thực" tiêu thụ.
-- Nếu tài khoản Supabase lại vượt hạn mức, cân nhắc gỡ bớt (đảo ngược migration
-- 20260826d cho riêng các bảng này) hoặc nâng gói cước.
--
-- Idempotent: chỉ ADD TABLE vào publication nếu bảng CHƯA có trong đó — an
-- toàn chạy lại nhiều lần.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor.
-- ============================================================================

do $$
declare
  t text;
  finance_realtime_tables text[] := array[
    'accounting_liabilities',
    'accounting_receivables',
    'accounting_sub_contracts',
    'cash_fund_config'
  ];
begin
  foreach t in array finance_realtime_tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
      raise notice 'Đã thêm bảng % vào Realtime publication.', t;
    else
      raise notice 'Bảng % đã có sẵn trong Realtime publication (bỏ qua).', t;
    end if;
  end loop;
end $$;
