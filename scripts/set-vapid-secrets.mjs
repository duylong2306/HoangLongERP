#!/usr/bin/env node
// ĐẶT KHÓA VAPID (gửi thông báo đẩy) CHO CÁC HÀM EDGE TRÊN SUPABASE LoLo — lấy cặp khóa sẵn có trong tệp .env (cục bộ).
//
// Cặp khóa: VITE_WEBPUSH_VAPID_PUBLIC_KEY (công khai, ứng dụng dùng) + WEBPUSH_VAPID_PRIVATE_KEY (BÍ MẬT, chỉ máy chủ).
// Script đọc 2 khóa từ .env, gọi `supabase secrets set` cho project LoLo (suy ra từ .env.staging.local), và KHÔNG in khóa riêng ra màn hình.
// Cần đã chạy `npx supabase login`. Dùng:  node scripts/set-vapid-secrets.mjs
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const die = (m) => { console.error(`\n⛔ ${m}\n`); process.exit(1); };
const load = (f) => {
  if (!fs.existsSync(f)) die(`Thiếu tệp ${f}.`);
  const e = {};
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) e[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  return e;
};

const env = load('.env');
const pub = env.VITE_WEBPUSH_VAPID_PUBLIC_KEY, priv = env.WEBPUSH_VAPID_PRIVATE_KEY;
if (!pub || !priv) die('Tệp .env thiếu VITE_WEBPUSH_VAPID_PUBLIC_KEY hoặc WEBPUSH_VAPID_PRIVATE_KEY.');
if (!/^B[A-Za-z0-9_-]{86}$/.test(pub)) die('Khóa công khai VAPID không đúng dạng (87 ký tự, bắt đầu bằng "B").');
if (!/^[A-Za-z0-9_-]{43}$/.test(priv)) die('Khóa riêng VAPID không đúng dạng (43 ký tự).');

// Project đích = LoLo (lấy từ .env.staging.local), tuyệt đối không phải production cũ
const ref = new URL(load('.env.staging.local').VITE_SUPABASE_URL).hostname.split('.')[0];
const prodRef = fs.existsSync('.env.production.local') ? new URL(load('.env.production.local').VITE_SUPABASE_URL).hostname.split('.')[0] : null;
if (!ref || ref === prodRef) die('Project đích trùng production hoặc không xác định — dừng.');

console.log(`Đặt VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY cho project LoLo (${ref})...`);
const r = spawnSync('npx', ['supabase', 'secrets', 'set', `VAPID_PUBLIC_KEY=${pub}`, `VAPID_PRIVATE_KEY=${priv}`, '--project-ref', ref], { stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8' });
const out = `${r.stdout || ''}${r.stderr || ''}`.split(priv).join('***').trim();   // phòng khi CLI in lại khóa riêng
if (out) console.log(out);
if (r.status !== 0) die('Lệnh supabase secrets set thất bại — xem thông báo ở trên.');
console.log(`\n✅ Đã đặt khóa cho các hàm Edge.\n\nKhóa CÔNG KHAI (an toàn để dán vào Vercel, biến VITE_WEBPUSH_VAPID_PUBLIC_KEY):\n${pub}\n`);
