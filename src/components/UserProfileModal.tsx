import React, { useState } from 'react';
import { Employee } from '../types';
import {
  X,
  User,
  MapPin,
  Phone,
  Lock,
  Camera,
  Check,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../context';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  onUpdateProfile: (updatedUser: Employee) => Promise<void>;
  accentTextClass: string;
  accentBgClass: string;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
];

const AVATAR_EMOJIS = ['👨‍💼', '👩‍💼', '👷‍♂️', '👩‍💻', '👨‍💻', '🦁', '🦉', '⚡', '🌟', '🚀', '🎨', '💼'];

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  accentTextClass,
  accentBgClass
}: UserProfileModalProps) {
  const { addToast } = useNotification();
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [password, setPassword] = useState(currentUser.password || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  
  // Custom image URL mode
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ title: '⚠️ Lỗi', message: 'Họ và tên không được để trống!', type: 'warning' });
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const updatedUser: Employee = {
        ...currentUser,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        password: password.trim() || '123',
        avatar: avatar
      };

      await onUpdateProfile(updatedUser);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error(error);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi cập nhật thông tin!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const selectAvatar = (urlOrEmoji: string) => {
    setAvatar(urlOrEmoji);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans select-none text-slate-200">
        
        {/* Backdrop clickable */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 ${accentTextClass}`}>
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  Cập Nhật Hồ Sơ Cá Nhân
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                  Thay đổi thông tin liên lạc và bảo mật tài khoản của bạn
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
            
            {/* Avatar Selection Section */}
            <div className="bg-slate-950/40 p-3.5 sm:p-4 rounded-xl border border-slate-850 space-y-3.5">
              <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Chọn ảnh đại diện / Avatar
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Active Avatar Preview */}
                <div className="relative group">
                  <div className="w-18 h-18 rounded-full flex items-center justify-center text-3xl font-black bg-slate-850 border-2 border-slate-700 text-white shadow-xl overflow-hidden shrink-0">
                    {avatar ? (
                      avatar.startsWith('http') ? (
                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-3xl select-none">{avatar}</span>
                      )
                    ) : (
                      <span className="text-2xl font-mono text-emerald-400 font-black">
                        {name ? name.charAt(0).toUpperCase() : 'U'}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-slate-700 text-slate-400">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Avatar Selection Options */}
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {PRESET_AVATARS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectAvatar(url)}
                        className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all hover:scale-105 shrink-0 ${avatar === url ? 'border-emerald-500 shadow-md shadow-emerald-500/20 scale-105' : 'border-transparent'}`}
                      >
                        <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => selectAvatar(emoji)}
                        className={`w-7 h-7 flex items-center justify-center rounded bg-slate-900 hover:bg-slate-800 border text-sm transition-all shrink-0 ${avatar === emoji ? 'border-emerald-500 text-base scale-105' : 'border-slate-800'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1.5 flex justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                      className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 uppercase tracking-wide bg-slate-900/60 p-1 px-2 rounded hover:bg-slate-800 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      {showCustomUrlInput ? 'Đóng nhập link' : 'Nhập Link ảnh tuỳ chọn'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Image URL Form */}
              {showCustomUrlInput && (
                <div className="mt-3.5 p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Nhập địa chỉ URL của hình ảnh:</span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.png"
                      value={customAvatarUrl}
                      onChange={(e) => setCustomAvatarUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 px-2 text-[11px] text-white outline-none focus:border-slate-700 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customAvatarUrl.trim()) {
                          setAvatar(customAvatarUrl.trim());
                          setCustomAvatarUrl('');
                          setShowCustomUrlInput(false);
                        }
                      }}
                      className="px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-all shrink-0"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              {/* Họ và Tên */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Họ và tên cán bộ *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pl-9 text-xs text-white outline-none focus:border-slate-700 font-bold transition-all"
                    placeholder="Nhập đầy đủ họ tên đệm"
                    required
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Số điện thoại */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Số điện thoại di động
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pl-9 text-xs text-white outline-none focus:border-slate-700 font-semibold transition-all"
                    placeholder="Ví dụ: 0912345678"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Địa chỉ */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Địa chỉ thường trú / Tạm trú
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pl-9 text-xs text-white outline-none focus:border-slate-700 font-semibold transition-all"
                    placeholder="Nhập địa chỉ của bạn"
                  />
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Mật khẩu thay đổi */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Mật khẩu truy cập hệ thống
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pl-9 pr-10 text-xs text-white outline-none focus:border-slate-700 font-mono font-bold transition-all"
                    placeholder="Mật khẩu bảo mật"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 transition-all"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                <span className="block text-[10px] text-slate-500 font-bold tracking-wide">
                  Gợi ý: Mật khẩu nên bảo mật và dễ nhớ để tránh quên tài khoản đăng nhập.
                </span>
              </div>
            </div>
          </form>

          {/* Footer controls */}
          <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-950/40">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-800"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${success ? 'bg-emerald-600 text-white' : accentBgClass} hover:opacity-95 disabled:opacity-50`}
            >
              {success ? (
                <>
                  <Check className="w-4 h-4" />
                  Thành công!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {loading ? 'Đang lưu...' : 'Lưu cập nhật'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
