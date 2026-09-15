import React from 'react';
import { Employee } from '../types';

interface UserAvatarProps {
  /** Employee object — ưu tiên dùng nếu có */
  employee?: Employee | null;
  /** Hoặc truyền thẳng name + avatar */
  name?: string;
  avatar?: string;
  /** Kích thước: 'xs'=20px | 'sm'=28px | 'md'=36px | 'lg'=44px | 'xl'=56px */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Bỏ ring viền trong */
  noRing?: boolean;
  /** className tuỳ chỉnh */
  className?: string;
  /** title tooltip */
  title?: string;
}

const SIZE_MAP = {
  xs: { w: 'w-5 h-5', text: 'text-[6px]', ring: 'ring-[1px]' },
  sm: { w: 'w-7 h-7', text: 'text-[8px]', ring: 'ring-[1px]' },
  md: { w: 'w-9 h-9', text: 'text-[11px]', ring: 'ring-[1.5px]' },
  lg: { w: 'w-11 h-11', text: 'text-sm', ring: 'ring-[1.5px]' },
  xl: { w: 'w-14 h-14', text: 'text-base', ring: 'ring-[2px]' },
};

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function getAvatarBgColor(name: string): string {
  const colors = [
    'bg-indigo-500', 'bg-red-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-purple-500', 'bg-blue-500',
    'bg-teal-500', 'bg-orange-500', 'bg-slate-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserAvatar({
  employee,
  name = '',
  avatar,
  size = 'md',
  noRing = false,
  className = '',
  title,
}: UserAvatarProps) {
  const effectiveName = employee?.name || name;
  const effectiveAvatar = employee?.avatar ?? avatar;

  const { w, text, ring } = SIZE_MAP[size];

  // 1) Ảnh thật (http/https/data URI)
  if (effectiveAvatar && effectiveAvatar.startsWith('http')) {
    return (
      <div className={`${w} rounded-full overflow-hidden ${noRing ? '' : 'ring-2 ring-white/10'} ${className}`} title={title || effectiveName}>
        <img
          src={effectiveAvatar}
          alt={effectiveName || 'Avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 2) Emoji (độ dài 1-2 ký tự Unicode, không phải http)
  if (effectiveAvatar && effectiveAvatar.length <= 2 && !effectiveAvatar.startsWith('http')) {
    return (
      <div className={`${w} rounded-full flex items-center justify-center ${noRing ? '' : `ring-2 ${ring} ring-white/10`} ${className}`} title={title || effectiveName}>
        <span className="text-[1.1em] select-none">{effectiveAvatar}</span>
      </div>
    );
  }

  // 3) Chữ cái fallback
  const bg = getAvatarBgColor(effectiveName || 'Unknown');
  return (
    <div
      className={`${w} rounded-full ${bg} flex items-center justify-center font-black text-white ${text} ${noRing ? '' : `ring-2 ${ring} ring-white/10`} ${className}`}
      title={title || effectiveName}
    >
      {getInitials(effectiveName || 'Unknown')}
    </div>
  );
}