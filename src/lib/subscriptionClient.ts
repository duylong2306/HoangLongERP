// Gọi api/subscription.ts từ trình duyệt (xem gói, hạn dùng, đặt mua/gia hạn) — dùng token ĐĂNG NHẬP ERP hiện có
// (token thường hoặc token KHÓA khi doanh nghiệp hết hạn). Máy chủ tự xác định công ty/nhân viên từ token.
import { getCurrentAccessToken } from './supabase';

export type SubStatus = 'unlimited' | 'trial' | 'active' | 'expired';

// Một dòng quyền lợi của gói: included = được nhận (✓) / không được nhận (✗).
export interface PlanFeature { text: string; included: boolean }
export interface SubscriptionPlan {
  id: string; name: string; description: string; priceMonthly: number; priceYearly: number; maxEmployees: number | null;
  badge?: string; features?: PlanFeature[];
}
export interface SubscriptionOrder {
  id: string; code: string; planId: string; planName: string; period: 'month' | 'year'; months: number; amount: number;
  status: 'pending' | 'confirmed' | 'cancelled'; createdAt: string; confirmedAt: string | null; periodEnd: string | null;
  paidClaimedAt?: string | null;   // lúc khách bấm "Xác nhận chuyển khoản thành công"
}
export interface BankInfo { bankName: string; bankBin?: string; accountNumber: string; accountName: string; note: string }
export interface SubscriptionStatus {
  company: { name: string; slug: string };
  subscription: { status: SubStatus; expiresAt: string | null; daysLeft: number | null; isTrial: boolean; locked: boolean; planId: string | null; planName: string | null; maxEmployees: number | null };
  employeeCount: number;
  canManage: boolean;
  bank: BankInfo | null;
  orders: SubscriptionOrder[];
}

export class SubscriptionApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function subscriptionCall<T = any>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const token = getCurrentAccessToken();
  let res: Response;
  try {
    res = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new SubscriptionApiError('Không kết nối được tới máy chủ. Vui lòng thử lại.', 0);
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new SubscriptionApiError(json?.error || 'Có lỗi xảy ra, vui lòng thử lại.', res.status);
  return json as T;
}

// "Dùng thử: còn 3 ngày" / "Còn 200 ngày" / "Đã hết hạn" — dùng chung cho thanh thông báo và trang gia hạn.
export function describeRemaining(daysLeft: number | null, status: SubStatus): string {
  if (status === 'unlimited') return 'Không giới hạn thời gian';
  if (status === 'expired') return 'Đã hết hạn';
  return daysLeft === 1 ? 'Còn 1 ngày' : `Còn ${daysLeft} ngày`;
}
