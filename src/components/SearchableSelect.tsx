import React, { useState, useRef, useEffect } from 'react';

export interface SearchableSelectOption {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  /** Danh sách tùy chọn */
  options: SearchableSelectOption[];
  /** Giá trị đã chọn (id) */
  value: string;
  /** Callback khi chọn */
  onChange: (id: string) => void;
  /** Placeholder cho input hiển thị */
  placeholder?: string;
  /** Placeholder cho ô tìm kiếm trong dropdown */
  searchPlaceholder?: string;
  /** Bắt buộc chọn (hiển thị gạch đỏ) */
  required?: boolean;
  /** Vô hiệu hóa */
  disabled?: boolean;
  /** Class CSS bổ sung cho wrapper */
  className?: string;
}

/**
 * SearchableSelect — Dropdown có ô tìm kiếm nhanh, chỉ cho phép chọn từ danh sách.
 *
 * UX:
 * - Click input → mở dropdown
 * - Gõ chữ trong ô tìm → lọc danh sách theo label (case-insensitive)
 * - Chọn item → ghi nhận giá trị, đóng dropdown
 * - Click ra ngoài → đóng dropdown, giữ nguyên giá trị đã chọn
 * - Input chính readOnly, không cho nhập giá trị ngoài danh sách
 */
const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '— Chọn —',
  searchPlaceholder = '🔍 Gõ để tìm...',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.id === value)?.label || '';

  // Tự focus ô tìm kiếm khi dropdown mở
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = options.filter(
    o => !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`}>
      {/* Input hiển thị — readOnly */}
      <input
        type="text"
        readOnly
        required={required}
        disabled={disabled}
        value={isOpen ? search : selectedLabel}
        onFocus={() => { if (!disabled) { setSearch(''); setIsOpen(true); } }}
        placeholder={placeholder}
        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          {/* Overlay bắt sự kiện click ra ngoài */}
          <div className="fixed inset-0 z-[190]" onClick={() => setIsOpen(false)} />

          <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[200] overflow-hidden">
            {/* Ô tìm kiếm */}
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

            {/* Danh sách */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setSearch(''); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-[10.5px] ${
                    opt.id === value ? 'bg-slate-900 text-sky-400 font-semibold' : 'text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-3 text-slate-500 text-center text-[10px]">Không tìm thấy kết quả.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchableSelect;
