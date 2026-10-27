-- CHUYỂN TIN HỆ THỐNG CŨ TRONG NHÓM CHAT DỰ ÁN → NHẬT KÝ DỰ ÁN (chuẩn bị bảng).
-- Chạy thủ công trong Supabase SQL Editor, SAU 20261027_project_events.sql. Chạy lại nhiều lần vẫn an toàn.
-- Việc chuyển dữ liệu do scripts/migrate-project-chat-events.mjs làm (chạy thử → --ghi → --xoa).

-- 1) Nhật ký có thêm: ảnh/tệp đính kèm (vd. báo cáo hoàn thành kèm ảnh) và mã tin gốc (chống chuyển trùng)
alter table public.project_events add column if not exists attachments jsonb;
alter table public.project_events add column if not exists source_msg_id text;

-- Mỗi tin gốc chỉ thành TỐI ĐA 1 dòng nhật ký (NULL = sự kiện ghi trực tiếp, không bị ràng buộc)
create unique index if not exists project_events_source_msg
  on public.project_events (company_id, source_msg_id);

-- 2) Bảng SAO LƯU tin trước khi xóa khỏi nhóm chat (nguyên dòng chat_messages dưới dạng JSON → khôi phục được)
create table if not exists public.chat_messages_legacy_backup (
  id              text primary key,
  company_id      uuid not null,
  conversation_id text,
  data            jsonb not null,
  backed_up_at    timestamptz not null default now()
);
create index if not exists chat_messages_legacy_backup_company on public.chat_messages_legacy_backup (company_id);

-- Bật RLS và KHÔNG tạo chính sách nào: người dùng ứng dụng không đọc/ghi được, chỉ khóa service_role (công cụ chuyển) mới vào được
alter table public.chat_messages_legacy_backup enable row level security;
