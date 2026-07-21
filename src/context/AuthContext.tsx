import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { Employee, HrmRoleGroup } from '../types';
import { dbService } from '../lib/dbService';
import { generateUsername } from './SettingsContext';

// ─── Context Type ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  currentUser: Employee | null;
  setCurrentUser: (user: Employee | null) => void;
  isLoggedIn: boolean;
  handleLoginSuccess: (loggedInUser: Employee, remember: boolean, autoLogin: boolean) => void;
  handleLogout: () => void;
  handleUpdateProfile: (updatedUser: Employee) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Admin Employee ───────────────────────────────────────────────────────────

const ADMIN_EMPLOYEE: Employee = {
  id: 'emp_admin',
  name: 'Administrator',
  role: 'director',
  roleGroupIds: ['role_admin'],
  email: 'admin@hoanglong.vn',
  phone: '0000000000',
  department: 'Ban Giám Đốc',
  username: 'admin',
  password: 'admin'
};

export function ensureAdminAndPasswords(emps: Employee[]): Employee[] {
  const mapped: Employee[] = emps.map(emp => {
    if (emp.username === 'admin' || emp.id === 'emp_admin') {
      return { ...emp, username: 'admin', password: 'admin', role: 'director' as const, roleGroupIds: ['role_admin'] };
    }
    // Backfill roleGroupIds từ memberIds của Role Groups (tương thích dữ liệu cũ)
    let roleGroupIds = emp.roleGroupIds;
    if (!roleGroupIds || roleGroupIds.length === 0) {
      try {
        // Đọc từ cache của dbService trước (nếu có)
        const cached = localStorage.getItem('hl_cached_hrm_role_groups');
        let groups: any[] = [];
        if (cached) {
          groups = JSON.parse(cached);
        }
        if (!Array.isArray(groups) || groups.length === 0) {
          const saved = localStorage.getItem('hl_hrm_roles_v2');
          if (saved) {
            groups = JSON.parse(saved);
          }
        }
        if (Array.isArray(groups)) {
          roleGroupIds = groups
            .filter(g => g.memberIds?.includes(emp.id))
            .map((g: any) => g.id);
        }
      } catch { /* ignore */ }
      // Fallback cuối cùng: nếu vẫn rỗng, giữ nguyên legacy role để isAccessible fallback hoạt động
    }
    return {
      ...emp,
      roleGroupIds,
      username: emp.username || generateUsername(emp.name),
      password: emp.password || '123'
    };
  });
  if (!mapped.some(e => e.username === 'admin' || e.id === 'emp_admin')) {
    mapped.unshift(ADMIN_EMPLOYEE);
  }
  return mapped;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({
  children,
  employees,
  addToast,
}: {
  children: ReactNode;
  employees: Employee[];
  addToast: (toast: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => void;
}) {
  // Initialize currentUser from session/localStorage
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const sessionActive = sessionStorage.getItem('hl_erp_active_session');
    if (sessionActive) {
      try { return JSON.parse(sessionActive); } catch {} /* eslint-disable-line no-empty */
    }
    const savedSession = localStorage.getItem('hl_erp_active_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        sessionStorage.setItem('hl_erp_active_session', savedSession);
        return parsed;
      } catch {} /* eslint-disable-line no-empty */
    }
    return null;
  });

  const isLoggedIn = currentUser !== null;

  // Update session storage whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('hl_erp_active_session', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('hl_erp_active_session');
    }
  }, [currentUser]);

  // ── Login Handler ──
  const handleLoginSuccess = useCallback(
    (loggedInUser: Employee, remember: boolean, autoLogin: boolean) => {
      setCurrentUser(loggedInUser);

      if (remember) {
        const creds = {
          username: loggedInUser.username || generateUsername(loggedInUser.name),
          password: loggedInUser.password || '123'
        };
        localStorage.setItem('hl_erp_remembered_credentials', JSON.stringify(creds));
      } else {
        localStorage.removeItem('hl_erp_remembered_credentials');
      }

      if (autoLogin) {
        localStorage.setItem('hl_erp_active_session', JSON.stringify(loggedInUser));
      } else {
        localStorage.removeItem('hl_erp_active_session');
      }

      sessionStorage.setItem('hl_erp_active_session', JSON.stringify(loggedInUser));

      addToast({
        title: 'Đăng nhập thành công',
        message: `Chào mừng ${loggedInUser.name} đã quay trở lại làm việc.`,
        type: 'success'
      });
    },
    [addToast]
  );

  // ── Logout Handler ──
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('hl_erp_active_session');
    localStorage.removeItem('hl_erp_active_session');
    addToast({
      title: 'Đăng xuất thành công',
      message: 'Hẹn gặp lại bạn ở những phiên làm việc tiếp theo.',
      type: 'info'
    });
  }, [addToast]);

  // ── Profile Update Handler ──
  const handleUpdateProfile = useCallback(
    async (updatedUser: Employee): Promise<void> => {
      setCurrentUser(updatedUser);
      sessionStorage.setItem('hl_erp_active_session', JSON.stringify(updatedUser));

      const savedSession = localStorage.getItem('hl_erp_active_session');
      if (savedSession) {
        localStorage.setItem('hl_erp_active_session', JSON.stringify(updatedUser));
      }

      // Update remembered credentials if applicable
      const remembered = localStorage.getItem('hl_erp_remembered_credentials');
      if (remembered) {
        try {
          const parsed = JSON.parse(remembered);
          if (parsed.username === updatedUser.username) {
            localStorage.setItem('hl_erp_remembered_credentials', JSON.stringify({
              username: updatedUser.username,
              password: updatedUser.password
            }));
          }
        } catch {} /* eslint-disable-line no-empty */
      }

      // Update in employees list (this happens in App.tsx via setEmployees)
      // Sync to cloud
      try {
        await dbService.employees.save(updatedUser);
        addToast({
          title: 'Cập nhật thành công',
          message: 'Hồ sơ cá nhân và mật khẩu của bạn đã được lưu trữ an toàn.',
          type: 'success'
        });
      } catch (err) {
        console.error('Lỗi khi đồng bộ Supabase:', err);
      }
    },
    [addToast]
  );

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    setCurrentUser,
    isLoggedIn,
    handleLoginSuccess,
    handleLogout,
    handleUpdateProfile,
  }), [currentUser, isLoggedIn, handleLoginSuccess, handleLogout, handleUpdateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
