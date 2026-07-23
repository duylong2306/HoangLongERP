import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  LogIn,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { verifyPasswordSync } from '../lib/passwordUtils';

interface LoginProps {
  brandName: string;
  brandSlogan: string;
  logoText: string;
  primaryAccent: string;
  employees: Employee[];
  onLoginSuccess: (employee: Employee, remember: boolean, autoLogin: boolean) => void;
}

export default function Login({
  brandName,
  brandSlogan,
  logoText,
  primaryAccent,
  employees,
  onLoginSuccess
}: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Load remembered credentials if they exist
  useEffect(() => {
    const remembered = localStorage.getItem('hl_erp_remembered_credentials');
    if (remembered) {
      try {
        const parsed = JSON.parse(remembered);
        if (parsed.username) setUsername(parsed.username);
        setRemember(true);
      } catch (e) {
        console.warn('Error parsing remembered credentials', e);
      }
    }
  }, []);

  // Sync AutoLogin and Remember
  useEffect(() => {
    if (autoLogin && !remember) {
      setRemember(true);
    }
  }, [autoLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
      return;
    }

    // Find employee
    const matchedEmployee = employees.find(
      emp => (emp.username || '').toLowerCase() === cleanUsername && verifyPasswordSync(cleanPassword, emp.password || '123')
    );

    if (!matchedEmployee) {
      setError('Tài khoản hoặc mật khẩu không đúng!');
      return;
    }

    setSuccessMsg(`Đăng nhập thành công! Chào mừng ${matchedEmployee.name}.`);

    setTimeout(() => {
      onLoginSuccess(matchedEmployee, remember, autoLogin);
    }, 600);
  };

  const handleQuickSelect = (emp: Employee) => {
    setUsername(emp.username || '');
    // For demo accounts, use '123' if password appears to be plaintext or default
    setPassword('123');
    setError(null);
  };

  const accentTextClass = 
    primaryAccent === 'emerald' ? 'text-emerald-400' :
    primaryAccent === 'sky' ? 'text-sky-400' :
    primaryAccent === 'indigo' ? 'text-indigo-400' :
    primaryAccent === 'amber' ? 'text-amber-400' :
    primaryAccent === 'rose' ? 'text-rose-400' : 'text-violet-400';

  const accentBgClass = 
    primaryAccent === 'emerald' ? 'bg-emerald-500 text-slate-950' :
    primaryAccent === 'sky' ? 'bg-sky-500 text-slate-950' :
    primaryAccent === 'indigo' ? 'bg-indigo-500 text-white' :
    primaryAccent === 'amber' ? 'bg-amber-500 text-slate-950' :
    primaryAccent === 'rose' ? 'bg-rose-500 text-white' : 'bg-violet-500 text-white';

  const accentBorderClass = 
    primaryAccent === 'emerald' ? 'focus:border-emerald-500' :
    primaryAccent === 'sky' ? 'focus:border-sky-500' :
    primaryAccent === 'indigo' ? 'focus:border-indigo-500' :
    primaryAccent === 'amber' ? 'focus:border-amber-500' :
    primaryAccent === 'rose' ? 'focus:border-rose-500' : 'focus:border-violet-500';

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-y-auto select-none font-sans text-slate-200">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10"
        id="login_form_card"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg font-black text-xl italic font-mono ${accentBgClass}`}>
            {logoText}
          </div>
          <div>
            <h1 className="font-black text-lg tracking-wider uppercase text-white">
              Hệ Thống Doanh Nghiệp {brandName}
            </h1>
            <span className={`text-xs font-bold tracking-widest mt-1 block uppercase ${accentTextClass}`}>
              {brandSlogan}
            </span>
          </div>
        </div>

        {/* Main form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Tên đăng nhập
            </label>
            <div className="relative">
              <input
                id="login_username_input"
                type="text"
                placeholder="Nhập tài khoản (ví dụ: hllong, ketoan1...)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pl-10 text-xs text-white outline-none placeholder-slate-600 transition-all font-bold ${accentBorderClass}`}
                required
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="login_password_input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu truy cập"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pl-10 pr-10 text-xs text-white outline-none placeholder-slate-600 transition-all font-bold ${accentBorderClass}`}
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-all"
                title={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Session checkboxes */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  if (!e.target.checked) {
                    setAutoLogin(false);
                  }
                }}
                className="rounded accent-emerald-500 h-4 w-4 cursor-pointer"
              />
              <span>Ghi nhớ tài khoản</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all select-none" title="Không cần đăng nhập lại ở những lần truy cập sau">
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={(e) => setAutoLogin(e.target.checked)}
                className="rounded accent-emerald-500 h-4 w-4 cursor-pointer"
              />
              <span>Tự động đăng nhập</span>
            </label>
          </div>

          {/* Status Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            id="login_submit_btn"
            className={`w-full py-2.5 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer ${accentBgClass} hover:opacity-90`}
          >
            <LogIn className="w-4 h-4" />
            Vào hệ thống ERP
          </button>
        </form>

        </motion.div>

      {/* Footer Branding */}
      <div className="mt-6 text-center text-[10px] text-slate-500 tracking-wider select-none font-mono">
        © 2026 {brandName} Lâm Đồng ERP. Toàn bộ thông tin được bảo mật nội bộ.
      </div>
    </div>
  );
}
