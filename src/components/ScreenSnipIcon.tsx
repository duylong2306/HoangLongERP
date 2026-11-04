import React from 'react';

/** Biểu tượng "khoanh vùng chụp màn hình": khung nét đứt + con trỏ chuột (quen mắt như nút chụp của Zalo, không dùng logo của hãng nào). */
export default function ScreenSnipIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="15" height="15" rx="2.5" strokeDasharray="3 2.4" />
      <path d="M12.5 12.5l8 3.2-3.3 1.2-1.2 3.3z" fill="currentColor" />
    </svg>
  );
}
