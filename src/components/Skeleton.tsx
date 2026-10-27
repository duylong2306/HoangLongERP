import type { CSSProperties } from 'react';
import MiniLoader from './MiniLoader';

/** Một khối "khung xương" có vệt sáng chạy ngang */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`lolo-sk ${className}`.trim()} style={style} />;
}

/**
 * KHUNG XƯƠNG cho vùng danh sách / bảng đang tải (phương án D): dựng sẵn các hàng (ô tròn/vuông + 2 dòng chữ) có vệt sáng chạy,
 * kèm nhãn nhỏ "Đang tải…" ở góc dưới phải. Dùng thay cho dòng chữ "Đang tải…" kèm vòng xoay để giao diện không "nhảy" khi dữ liệu về.
 *   rows: số hàng · avatar: có ô tròn/vuông đầu hàng · label: chữ ở nhãn góc (rỗng = ẩn nhãn)
 */
export function ListSkeleton({ rows = 5, avatar = true, label = 'Đang tải…', className = '' }: { rows?: number; avatar?: boolean; label?: string; className?: string }) {
  const widths = [['70%', '46%'], ['58%', '64%'], ['76%', '38%'], ['52%', '58%'], ['66%', '44%']];
  return (
    <div role="status" aria-label={label || 'Đang tải'} data-testid="list-skeleton" className={`relative flex flex-col gap-3 ${className}`.trim()}>
      {Array.from({ length: rows }, (_, i) => {
        const [a, b] = widths[i % widths.length];
        return (
          <div key={i} className="flex items-center gap-3" data-testid="skeleton-row">
            {avatar && <Skeleton className="shrink-0" style={{ width: 44, height: 44, borderRadius: 13 }} />}
            <div className="flex-1 flex flex-col gap-2"><Skeleton style={{ height: 12, width: a }} /><Skeleton style={{ height: 10, width: b }} /></div>
          </div>
        );
      })}
      {label && (
        <span className="absolute right-0 -bottom-1 inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-2 pr-3 py-1 text-[12px] font-bold text-[#0d47c9] shadow-sm">
          <MiniLoader size={12} />{label}
        </span>
      )}
    </div>
  );
}
