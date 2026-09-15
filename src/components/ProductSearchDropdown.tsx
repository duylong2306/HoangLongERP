import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AccountingProductItem } from '../types';

interface ProductSearchDropdownProps {
  filteredProducts: AccountingProductItem[];
  onSelect: (product: AccountingProductItem) => void;
  isOpen: boolean;
  triggerElement: HTMLInputElement | null;
}

export default function ProductSearchDropdown({
  filteredProducts,
  onSelect,
  isOpen,
  triggerElement
}: ProductSearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update position when open
  useEffect(() => {
    if (!isOpen || !triggerElement) return;

    const updatePosition = () => {
      if (!triggerElement || !dropdownRef.current) return;

      const rect = triggerElement.getBoundingClientRect();

      // Check if rect has valid dimensions
      if (rect.width === 0 && rect.height === 0) {
        // Element not ready yet, try again in next frame
        requestAnimationFrame(updatePosition);
        return;
      }

      // Calculate position relative to viewport
      const scrollX = window.scrollX || document.documentElement.scrollLeft;
      const scrollY = window.scrollY || document.documentElement.scrollTop;

      setPosition({
        top: rect.bottom + scrollY + 2,
        left: rect.left + scrollX,
        width: rect.width
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, triggerElement]);

  if (!isOpen || filteredProducts.length === 0) return null;

  return ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      className="bg-white border border-slate-300 rounded-lg shadow-xl max-h-60 overflow-y-auto"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: 280,
        zIndex: 2147483647 // Maximum z-index for 32-bit signed integer
      }}
    >
      {filteredProducts.map(p => (
        <div
          key={p.id}
          className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-b-0"
          onClick={() => onSelect(p)}
        >
          <div className="font-bold text-slate-800 text-[10px]">{p.tenSanPham}</div>
          <div className="text-[9px] text-slate-500">
            Mã: {p.id} · Giá: {p.donGia?.toLocaleString('vi-VN') || 0}₫ · ĐVT: {p.donViTinh || 'Cái'}
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}