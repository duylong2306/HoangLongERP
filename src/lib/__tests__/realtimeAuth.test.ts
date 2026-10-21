import { describe, it, expect, vi, beforeEach } from 'vitest';

// Realtime phải dùng JWT đăng nhập (không phải khóa anon) thì mới nhận được sự kiện của bảng có RLS.
const h = vi.hoisted(() => ({ setAuth: vi.fn(async () => {}) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ realtime: { setAuth: h.setAuth } })) }));
import { initializeSupabase } from '../supabase';

beforeEach(() => h.setAuth.mockClear());

describe('Realtime dùng JWT đăng nhập', () => {
  it('có token → đặt token cho Realtime', () => {
    initializeSupabase('https://x.supabase.co', 'anon', 'jwt-abc');
    expect(h.setAuth).toHaveBeenCalledWith('jwt-abc');
  });
  it('chưa đăng nhập (không token) → không đặt', () => {
    initializeSupabase('https://x.supabase.co', 'anon', null);
    expect(h.setAuth).not.toHaveBeenCalled();
  });
});
