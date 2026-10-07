// Kiểm tra dữ liệu ĐĂNG KÝ DOANH NGHIỆP (Giai đoạn 2 — website đăng ký công khai).
// Hàm thuần (không gọi DB/mạng) để test được; api/register-company.ts và api/check-slug.ts dùng chung.
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
import type { VercelRequest } from '@vercel/node';
import { createHash } from 'crypto';
import { RESERVED_SUBDOMAINS, SLUG_PATTERN } from './_tenant.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)

export type SlugProblem = 'invalid' | 'reserved';

// null = dùng được về mặt hình thức (còn phải kiểm tra trùng trong DB).
export function slugProblem(slug: string): SlugProblem | null {
  if (!SLUG_PATTERN.test(slug)) return 'invalid';
  if (RESERVED_SUBDOMAINS.includes(slug)) return 'reserved';
  return null;
}

export const SLUG_MESSAGES: Record<SlugProblem | 'taken', string> = {
  invalid: 'Địa chỉ chỉ gồm chữ thường không dấu, số và dấu gạch ngang (2–40 ký tự), không bắt đầu hoặc kết thúc bằng dấu gạch ngang.',
  reserved: 'Địa chỉ này dành cho hệ thống, vui lòng chọn tên khác.',
  taken: 'Địa chỉ này đã có doanh nghiệp sử dụng, vui lòng chọn tên khác.',
};

export interface SignupInput {
  companyName?: unknown;
  slug?: unknown;
  adminName?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
}

export interface CleanSignup {
  companyName: string;
  slug: string;
  adminName: string;
  email: string;
  phone: string;
  password: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Số điện thoại Việt Nam: 0xxxxxxxxx (10 số) hoặc +84/84 + 9 số. Bỏ khoảng trắng, dấu chấm, gạch ngang trước khi kiểm tra.
const PHONE_RE = /^(0\d{9}|(\+?84)\d{9})$/;

// Trả về { ok:true, data } với dữ liệu ĐÃ làm sạch, hoặc { ok:false, errors } (mỗi trường 1 thông báo tiếng Việt).
// (Kiểu kết quả đơn giản — không dùng union vì tsconfig không bật strict nên TypeScript không thu hẹp theo `ok`.)
export interface SignupValidation { ok: boolean; data?: CleanSignup; errors?: Record<string, string> }
export function validateSignup(input: SignupInput): SignupValidation {
  const errors: Record<string, string> = {};
  const companyName = str(input.companyName).trim().replace(/\s+/g, ' ');
  const slug = str(input.slug).trim().toLowerCase();
  const adminName = str(input.adminName).trim().replace(/\s+/g, ' ');
  const email = str(input.email).trim().toLowerCase();
  const phone = str(input.phone).replace(/[\s.\-()]/g, '');
  const password = str(input.password);

  if (companyName.length < 2 || companyName.length > 100) errors.companyName = 'Tên doanh nghiệp từ 2 đến 100 ký tự.';
  const sp = slugProblem(slug);
  if (sp) errors.slug = SLUG_MESSAGES[sp];
  if (adminName.length < 2 || adminName.length > 80) errors.adminName = 'Họ tên người quản trị từ 2 đến 80 ký tự.';
  if (email.length > 120 || !EMAIL_RE.test(email)) errors.email = 'Email không hợp lệ.';
  if (!PHONE_RE.test(phone)) errors.phone = 'Số điện thoại không hợp lệ (ví dụ 0912345678).';
  // Mật khẩu: tối thiểu 8 ký tự, có cả chữ và số (không ép ký tự đặc biệt để dễ nhớ); giới hạn trên chống lạm dụng bcrypt.
  if (password.length < 8 || password.length > 72) errors.password = 'Mật khẩu từ 8 đến 72 ký tự.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Mật khẩu cần có cả chữ và số.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { companyName, slug, adminName, email, phone, password } };
}

// Địa chỉ IP người gọi (sau proxy Vercel: x-forwarded-for, giá trị đầu là IP thật).
export function getClientIp(req: VercelRequest): string {
  const raw = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '') as string | string[];
  const first = (Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
  return first || 'unknown';
}

// Băm IP (kèm muối) trước khi lưu — chỉ cần đếm số lần, không giữ IP thật của người đăng ký.
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex');
}

// Giới hạn số lượt đăng ký từ 1 IP.
export const SIGNUP_LIMIT_PER_HOUR = 3;
export const SIGNUP_LIMIT_PER_DAY = 10;
