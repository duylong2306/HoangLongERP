import React, { useState, useRef, useEffect } from 'react';
import type { SearchableSelectOption } from './SearchableSelect';

interface SearchableMultiSelectProps {
  /** Danh sách tùy chọn */
  options: SearchableSelectOption[];
  /** Các giá trị đã chọn (id) */
  value: string[];
  /** Callback khi danh sách chọn thay đổi */
  onChange: (ids: string[]) => void;
  /** Placeholder khi chưa chọn gì */
  placeholder?: string;
  /** Placeholder cho ô tìm kiếm trong dropdown */
  searchPlaceholder?: string;
  /** Vô hiệu hóa */
  disabled?: boolean;
  /** Class CSS bổ sung cho wrapper */
  className?: string;
}

/**
 * SearchableMultiSelect — Biến thể CHỌN NHIỀU của SearchableSelect (../SearchableSelect.tsx).
 * Cùng UX nền tảng (ô tìm kiếm lọc theo label, click ra ngoài để đóng) nhưng:
 * - Giá trị đã chọn hiển thị dạng "chip" có thể bấm x để bỏ, ngay trên ô điều khiển.
 * - Trong dropdown, mỗi dòng có checkbox — chọn nhiều dòng liên tiếp mà KHÔNG đóng dropdown
 *   (khác SearchableSelect vốn đóng ngay sau 1 lần chọn vì chỉ chọn được 1 giá trị).
 */
const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '— Chọn (có thể chọn nhiều) —',
  searchPlaceholder = '🔍 Gõ để tìm...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = options.filter(
    o => !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  const remove = (id: string) => onChange(value.filter(v => v !== id));

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Control — hiển thị các chip đã chọn, click để mở dropdown */}
      <div
        onClick={() => { if (!disabled) setIsOpen(true); }}
        className={`w-full min-h-[34px] bg-slate-950 border border-slate-800 rounded px-2 py-1 flex flex-wrap items-center gap-1 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-slate-700'}`}
      >
        {value.length === 0 ? (
          <span className="text-slate-500 text-xs px-0.5">{placeholder}</span>
        ) : (
          value.map(id => {
            const opt = options.find(o => o.id === id);
            return (
              <span
                key={id}
                onClick={(e) => { e.stopPropagation(); if (!disabled) remove(id); }}
                className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0"
                title={disabled ? undefined : 'Bấm để bỏ chọn'}
              >
                {opt ? opt.label : id}
                {!disabled && <span className="text-[9px] hover:text-rose-500 font-extrabold">×</span>}
              </span>
            );
          })
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[200] overflow-hidden min-w-[220px]">
            <div className="p-2 border-b border-slate-800">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white text-[10.5px] outline-none focus:border-sky-500"
              />
            </div>

            <div className="max-h-52 overflow-y-auto">
              {filtered.map(opt => {
                const checked = value.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-[10.5px] flex items-center gap-2 ${
                      checked ? 'bg-slate-900 text-sky-400 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => {}} className="pointer-events-none accent-sky-500 h-3 w-3" />
                    {opt.label}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-3 text-slate-500 text-center text-[10px]">Không tìm thấy kết quả.</div>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800 bg-slate-950">
              <span className="text-[10px] text-slate-500">Đã chọn: <span className="text-sky-400 font-bold">{value.length}</span></span>
              <button type="button" onClick={() => setIsOpen(false)} className="text-[10px] text-slate-400 hover:text-white font-bold">
                Xong
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchableMultiSelect;
