<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Hoàng Long ERP 3.9

Hệ thống quản trị doanh nghiệp - Lâm Đồng ERP

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
3. Run the app:
   `npm run dev`

## Deploy to Vercel

### Bước 1: Cấu hình Environment Variables

⚠️ **QUAN TRỌNG:** Bạn PHẢI cấu hình Supabase env vars trên Vercel. Nếu không, ứng dụng sẽ hiển thị **dữ liệu trống** vì không kết nối được database.

1. Vào **Vercel Dashboard** > Chọn project > **Settings** > **Environment Variables**
2. Thêm 2 biến sau:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://cyuunmrdrymhzxfcruoe.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Lấy từ Supabase Dashboard > Project Settings > API > `anon` `public` | Production, Preview, Development |

3. Nhấn **Save** rồi **Redeploy** project

### Bước 2: Lấy Supabase Anon Key

1. Vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project `cyuunmrdrymhzxfcruoe`
3. Vào **Project Settings** > **API**
4. Copy giá trị `anon` `public` key

### Bước 3: Verify

Sau khi deploy, mở ứng dụng trên Vercel và kiểm tra:
- Nhấn **F12** > Console tab
- Nếu thấy `[Supabase] Successfully initialized` = ✅ Kết nối thành công
- Nếu thấy `Supabase credentials missing` = ❌ Thiếu env vars, cần cấu hình lại

## Architecture

- **Frontend:** React + TypeScript + Vite
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Data Flow:** localStorage (cache) → Supabase (source of truth)
