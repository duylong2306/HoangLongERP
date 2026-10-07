-- ============================================================================
-- TRANG QUẢN TRỊ NỀN TẢNG (lolo.io.vn/quantri) + GÓI DỊCH VỤ / DÙNG THỬ / ĐƠN ĐĂNG KÝ.
--
-- Vì sao: trước đây "Quản Lý Doanh Nghiệp" nằm TRONG ERP và gắn với admin của công ty Hoàng Long → quyền quản trị
-- nền tảng dính vào tài khoản của 1 doanh nghiệp (lỗ hổng). Nay tách ra trang riêng, tài khoản riêng (platform_admins,
-- KHÔNG phải nhân viên của doanh nghiệp nào), và thêm quản lý gói/hạn dùng.
--
-- Tất cả bảng mới BẬT RLS và KHÔNG có policy nào → khóa công khai (anon/authenticated) không đọc/ghi được gì;
-- chỉ máy chủ (service_role, trong api/platform.ts và api/subscription.ts) truy cập.
--
-- CHỈ CHẠY TRÊN PROJECT "LoLo" (nền tảng đa doanh nghiệp). KHÔNG chạy trên production Hoàng Long cũ.
-- Idempotent — chạy lại không lỗi. Trong 1 transaction: lỗi giữa chừng thì rollback hết.
-- ============================================================================
begin;

-- 1) Tài khoản quản trị nền tảng ------------------------------------------------------------------
-- Tài khoản ĐẦU TIÊN tạo bằng scripts/create-platform-admin.mjs (nhập mật khẩu tại máy, in ra câu INSERT đã băm).
create table if not exists public.platform_admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  name          text not null default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
alter table public.platform_admins enable row level security;

-- 2) Lượt đăng nhập trang quản trị (chống dò mật khẩu) --------------------------------------------
-- Chỉ lưu BĂM của IP. Đếm lượt SAI gần đây theo IP và theo tên đăng nhập để tạm khóa.
create table if not exists public.platform_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  username   text not null default '',
  success    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_login_ip_time   on public.platform_login_attempts (ip_hash, created_at desc);
create index if not exists idx_platform_login_user_time on public.platform_login_attempts (username, created_at desc);
alter table public.platform_login_attempts enable row level security;

-- 3) Gói dịch vụ ----------------------------------------------------------------------------------
create table if not exists public.plans (
  id             text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name           text not null,
  description    text not null default '',
  price_monthly  bigint not null default 0 check (price_monthly >= 0),   -- VNĐ / tháng
  price_yearly   bigint not null default 0 check (price_yearly  >= 0),   -- VNĐ / năm
  max_employees  integer check (max_employees is null or max_employees > 0),  -- null = không giới hạn
  active         boolean not null default false,                         -- chỉ gói active mới hiện cho khách mua
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.plans enable row level security;

-- Gói mẫu, TẮT sẵn và giá 0 — admin vào trang quản trị đặt giá rồi bật. (on conflict: không ghi đè khi chạy lại)
insert into public.plans (id, name, description, price_monthly, price_yearly, max_employees, active, sort_order) values
  ('co-ban',        'Cơ bản',        'Dành cho doanh nghiệp nhỏ.',         0, 0, 10,   false, 10),
  ('chuyen-nghiep', 'Chuyên nghiệp', 'Dành cho doanh nghiệp vừa.',         0, 0, 50,   false, 20),
  ('doanh-nghiep',  'Doanh nghiệp',  'Không giới hạn số nhân viên.',       0, 0, null, false, 30)
on conflict (id) do nothing;

-- 4) Hạn dùng của từng doanh nghiệp ---------------------------------------------------------------
--   expires_at = null  → KHÔNG giới hạn (mọi doanh nghiệp đang có được giữ nguyên như vậy)
--   is_trial   = true  → đang dùng thử (đăng ký mới: hết hạn sau số ngày cấu hình, mặc định 7)
--   plan_id            → gói đang dùng (null khi dùng thử / không giới hạn)
alter table public.companies add column if not exists plan_id    text references public.plans(id);
alter table public.companies add column if not exists expires_at timestamptz;
alter table public.companies add column if not exists is_trial   boolean not null default false;

-- 5) Đơn đăng ký / gia hạn gói --------------------------------------------------------------------
-- Khách chọn gói + kỳ hạn → tạo đơn 'pending' kèm số tiền (chụp giá tại thời điểm đặt) + mã chuyển khoản.
-- Admin kiểm tra tiền về → xác nhận → công ty được kích hoạt/gia hạn (api/platform.ts, action orders.confirm).
create table if not exists public.subscription_orders (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                 -- nội dung chuyển khoản, ví dụ LOLO7K3M9QXD
  company_id   uuid not null references public.companies(id) on delete cascade,
  plan_id      text not null references public.plans(id),
  period       text not null check (period in ('month', 'year')),
  months       integer not null check (months in (1, 12)),
  amount       bigint not null check (amount >= 0),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  requested_by text,                                 -- id nhân viên (admin doanh nghiệp) đã đặt đơn
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.platform_admins(id),
  period_start timestamptz,
  period_end   timestamptz,
  note         text not null default ''
);
create index if not exists idx_sub_orders_company on public.subscription_orders (company_id, created_at desc);
create index if not exists idx_sub_orders_status  on public.subscription_orders (status, created_at desc);
alter table public.subscription_orders enable row level security;

-- 6) Cấu hình nền tảng ----------------------------------------------------------------------------
--   'trial' : { "days": 7, "maxEmployees": null }   — dùng thử cho doanh nghiệp đăng ký mới
--   'bank'  : { "bankName", "accountNumber", "accountName", "note" } — thông tin nhận chuyển khoản hiện cho khách
create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
insert into public.platform_settings (key, value) values
  ('trial', '{"days": 7, "maxEmployees": null}'::jsonb),
  ('bank',  '{"bankName": "", "accountNumber": "", "accountName": "", "note": ""}'::jsonb)
on conflict (key) do nothing;

-- 7) Đếm nhân viên theo công ty (cho trang quản trị — tránh kéo cả bảng employees về) -------------
create or replace function public.platform_employee_counts()
returns table (company_id uuid, employee_count bigint)
language sql stable
as $$
  select e.company_id, count(*)::bigint from public.employees e group by e.company_id
$$;
-- Chỉ máy chủ (service_role) được gọi — khóa công khai KHÔNG được biết số nhân viên của doanh nghiệp khác.
revoke all on function public.platform_employee_counts() from public, anon, authenticated;
grant execute on function public.platform_employee_counts() to service_role;

commit;
