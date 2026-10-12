import React from 'react';

// Chấm trạng thái online (xanh) / offline (xám) đặt góc dưới-phải của avatar (cha phải có class "relative").
export default function PresenceDot({ online, size = 'md' }: { online: boolean; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <span
      data-testid="presence-dot"
      data-online={online ? 'true' : 'false'}
      title={online ? 'Đang hoạt động' : 'Ngoại tuyến'}
      className={`absolute -bottom-0.5 -right-0.5 ${dim} rounded-full border-[2px] border-slate-950 ${online ? 'bg-emerald-500' : 'bg-slate-500'}`}
    />
  );
}
