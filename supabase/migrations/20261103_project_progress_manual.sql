-- TIẾN ĐỘ DỰ ÁN TỰ TÍNH + PM GHI ĐÈ: thêm cột lưu số do PM/Giám đốc nhập tay (null = dùng số tự tính theo cột kanban + việc con).
-- CHỈ CHẠY TRÊN PROJECT "LoLo". Idempotent. Chưa chạy thì mọi thứ vẫn hoạt động, chỉ riêng nút "Ghi đè tiến độ" sẽ không lưu được.
alter table public.projects add column if not exists progress_manual numeric;
