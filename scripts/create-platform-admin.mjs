#!/usr/bin/env node
// TẠO TÀI KHOẢN QUẢN TRỊ NỀN TẢNG (trang lolo.io.vn/quantri) — chạy trên MÁY CỦA BẠN, mật khẩu KHÔNG đi đâu cả.
//
// Script hỏi tên đăng nhập + mật khẩu (không hiện khi gõ), băm mật khẩu bằng bcrypt rồi IN RA câu lệnh SQL.
// Bạn dán câu SQL đó vào Supabase (SQL Editor) của project "LoLo". Mật khẩu thô không bao giờ được in ra hay lưu.
//
// Dùng:  node scripts/create-platform-admin.mjs
// Chạy lại với CÙNG tên đăng nhập = ĐẶT LẠI mật khẩu (và bật lại tài khoản nếu đang bị khóa).
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

// MỘT giao diện đọc duy nhất cho mọi câu hỏi (mỗi câu tạo giao diện riêng sẽ làm mất dữ liệu khi đầu vào được nạp sẵn).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
const dong = rl[Symbol.asyncIterator]();
let anKyTu = false;
const ghiGoc = rl._writeToOutput?.bind(rl);
// Khi đang nhập mật khẩu: không in ký tự gõ vào (chỉ in lại câu hỏi)
rl._writeToOutput = (s) => { if (!anKyTu) ghiGoc ? ghiGoc(s) : process.stdout.write(s); };

async function hoi(cauHoi, { an = false } = {}) {
  process.stdout.write(cauHoi);
  anKyTu = an;
  const { value } = await dong.next();
  anKyTu = false;
  if (an) process.stdout.write('\n');
  return value ?? '';
}

const username = (await hoi('Tên đăng nhập quản trị (chữ thường, số, . _ -) [quantri]: ')).trim().toLowerCase() || 'quantri';
if (!/^[a-z0-9._-]{3,40}$/.test(username)) { console.error('⛔ Tên đăng nhập chỉ gồm chữ thường, số, dấu . _ - (3–40 ký tự).'); rl.close(); process.exit(1); }
const name = (await hoi('Họ tên hiển thị [Quản trị nền tảng]: ')).trim().replace(/'/g, "''").slice(0, 80) || 'Quản trị nền tảng';

const mk1 = await hoi('Mật khẩu (tối thiểu 10 ký tự, có cả chữ và số): ', { an: true });
if (mk1.length < 10 || mk1.length > 72 || !/[A-Za-z]/.test(mk1) || !/\d/.test(mk1)) {
  console.error('⛔ Mật khẩu từ 10 đến 72 ký tự và phải có cả chữ lẫn số.'); process.exit(1);
}
const mk2 = await hoi('Nhập lại mật khẩu: ', { an: true });
if (mk1 !== mk2) { console.error('⛔ Hai lần nhập mật khẩu không khớp.'); rl.close(); process.exit(1); }

const hash = await bcrypt.hash(mk1, 12);

console.log(`
✅ Đã băm mật khẩu. Dán câu SQL dưới đây vào Supabase (project "LoLo") > SQL Editor rồi bấm Run:

insert into public.platform_admins (username, password_hash, name)
values ('${username}', '${hash}', '${name}')
on conflict (username) do update
  set password_hash = excluded.password_hash, name = excluded.name, active = true;

Sau đó đăng nhập tại https://www.<tên-miền-gốc>/quantri bằng tên đăng nhập "${username}" và mật khẩu vừa nhập.
(Mật khẩu KHÔNG được lưu ở đâu cả — quên thì chạy lại script này để đặt mật khẩu mới.)
`);
rl.close();
