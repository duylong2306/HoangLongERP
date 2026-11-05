// MENU CHUYỂN TAB CỦA "HỆ THỐNG NHÂN SỰ" — thiết kế mới, dùng chung một danh sách tab cho cả máy tính và điện thoại.
//  - Máy tính (≥ md): thanh tab ngang dạng nút bo tròn có biểu tượng; tab đang chọn tô xanh LoLo.
//  - Điện thoại (< md): thanh gọn "☰ + tên tab" ở đầu trang; bấm ☰ trượt ra ngăn kéo hẹp BÊN TRÁI (biểu tượng trên, chữ dưới),
//    mặc định ẩn để dành chỗ cho nội dung. Ngăn kéo phủ kín cả thanh dưới của app (giống các ngăn kéo chi tiết khác, z ≥ 50).
//  - Chấm đỏ đếm số trên "Nghỉ phép" = số đơn đang chờ DUYỆT mà người dùng hiện tại duyệt được.
// Chỉ là phần điều hướng: không đổi nội dung/phân quyền của từng tab.
import { useEffect, useState } from 'react';
import { Menu, UserCheck, Clock, Calendar, DollarSign, MapPin, Award, X } from 'lucide-react';

export interface HrTabDef {
  id: string;
  /** Tên đầy đủ (thanh tab máy tính, tiêu đề điện thoại) */
  label: string;
  /** Tên ngắn dưới biểu tượng trong ngăn kéo hẹp */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
}

// 6 tab thật của module (Dữ liệu nhân sự và Phân quyền có lối vào riêng ở menu chính / Cài đặt nên không nằm ở đây).
export const HR_TABS: HrTabDef[] = [
  { id: 'profiles', label: 'Hồ sơ nhân viên', short: 'Hồ sơ', icon: UserCheck },
  { id: 'attendance', label: 'Chấm công ngày', short: 'Chấm công', icon: Clock },
  { id: 'leaves', label: 'Đơn nghỉ phép', short: 'Nghỉ phép', icon: Calendar },
  { id: 'payroll', label: 'Tính lương tự động', short: 'Lương', icon: DollarSign },
  { id: 'trips', label: 'Công tác phí', short: 'Công tác phí', icon: MapPin },
  { id: 'performance', label: 'Hiệu suất', short: 'Hiệu suất', icon: Award },
];

interface NavProps {
  active: string;
  onChange: (id: string) => void;
  /** Số đếm hiện thành chấm đỏ trên từng tab, vd { leaves: 3 } (0 / không có → không hiện) */
  badges?: Record<string, number>;
}

/** Thanh tab máy tính — ẩn trên điện thoại. */
export function HrDesktopTabs({ active, onChange, badges = {} }: NavProps) {
  return (
    <nav aria-label="Menu nhân sự" data-testid="hr-desktop-tabs"
      className="hidden md:flex flex-wrap items-center gap-1.5 mb-5 pb-4 border-b border-slate-200">
      {HR_TABS.map(t => {
        const on = active === t.id;
        const n = badges[t.id] || 0;
        const Icon = t.icon;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-current={on ? 'page' : undefined} data-testid={`hr-tab-${t.id}`}
            // Nền/chữ đặt inline: index.css ép màu cho text-white / bg-* nên class Tailwind không đủ tin cậy cho nút nền xanh
            style={on ? { background: '#0d47c9', color: '#ffffff' } : undefined}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? '' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
            <Icon className="w-4 h-4" />
            <span>{t.label}</span>
            {n > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center font-black"
                style={on ? { background: '#ffffff', color: '#0d47c9' } : { background: '#ef4444', color: '#ffffff' }}>{n}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** Thanh "☰ + tên tab" và ngăn kéo bên trái — chỉ hiện trên điện thoại. */
export function HrMobileNav({ active, onChange, badges = {} }: NavProps) {
  const [open, setOpen] = useState(false);
  const current = HR_TABS.find(t => t.id === active);
  const totalBadge = Object.values(badges).reduce((s, n) => s + (n || 0), 0);

  // Bấm phím Esc đóng ngăn kéo (khi có bàn phím) + khóa cuộn trang nền lúc ngăn kéo mở
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); };

  return (
    <div className="md:hidden" data-testid="hr-mobile-nav">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-200">
        <button type="button" onClick={() => setOpen(true)} aria-label="Mở menu nhân sự" aria-expanded={open} data-testid="hr-menu-btn"
          style={{ background: '#e8efff', color: '#0d47c9' }}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer">
          <Menu className="w-5 h-5" />
          {totalBadge > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: '#ef4444' }} />}
        </button>
        <div className="min-w-0">
          <div className="text-[15px] font-black text-slate-900 truncate" data-testid="hr-current-tab">{current?.label || 'Hệ thống nhân sự'}</div>
          <div className="text-[11px] text-slate-500">Hệ thống nhân sự</div>
        </div>
      </div>

      {open && (
        // Phủ kín như các ngăn kéo chi tiết (z-50 > thanh dưới z-46); nền mờ bấm để đóng, ngăn hẹp bên trái
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu nhân sự" data-testid="hr-drawer">
          <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,.45)' }} onClick={() => setOpen(false)} data-testid="hr-drawer-scrim" />
          <div className="absolute left-0 top-0 bottom-0 w-[84px] bg-white border-r border-slate-200 flex flex-col gap-1 px-1.5 overflow-y-auto"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng menu" data-testid="hr-drawer-close"
              className="self-center w-9 h-9 mb-1 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
            {HR_TABS.map(t => {
              const on = active === t.id;
              const n = badges[t.id] || 0;
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" onClick={() => pick(t.id)} aria-current={on ? 'page' : undefined} data-testid={`hr-drawer-${t.id}`}
                  style={on ? { background: '#e8efff', color: '#0d47c9' } : undefined}
                  className={`relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 rounded-xl text-[11px] font-bold leading-tight text-center cursor-pointer ${on ? '' : 'text-slate-600'}`}>
                  <Icon className="w-[22px] h-[22px]" />
                  <span>{t.short}</span>
                  {n > 0 && (
                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] leading-4 font-black text-center"
                      style={{ background: '#ef4444', color: '#ffffff' }}>{n}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
