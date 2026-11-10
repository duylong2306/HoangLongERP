// THANH PHÂN TRANG DÙNG CHUNG cho các màn hình dạng danh sách (kiểu LoLo):
//  - Bên trái : "Hiển thị a–b / tổng" (đang xem dòng nào)
//  - Ở giữa   : nút Trước / số trang / Sau (điện thoại chỉ hiện "Trang x / y" cho gọn)
//  - Bên phải : chọn "số dòng mỗi trang" (5/10/20/50/Tất cả) — LUÔN hiện, kể cả khi danh sách ngắn
// pageSize = -1 nghĩa là "Tất cả" (không phân trang).
import React, { useEffect, useState } from 'react';

export const DEFAULT_PAGE_SIZES = [5, 10, 20, 50];

/** Tính danh sách số trang hiển thị: luôn có trang đầu/cuối, quanh trang hiện tại ±1, "…" ở khoảng trống. */
export function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const nums = Array.from(set).filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

/**
 * Hook phân trang: giữ page/pageSize, tự kẹp trang khi danh sách ngắn lại và trả về hàm cắt trang.
 * Dùng: const pg = usePagination(10); pg.slice(list) ; <TablePagination {...pg.props(list.length)} />
 */
export function usePagination(initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPagesOf = (total: number) => (pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize)));
  const safePageOf = (total: number) => Math.min(Math.max(1, page), totalPagesOf(total));
  return {
    page, pageSize, setPage, setPageSize,
    reset: () => setPage(1),
    /** Cắt đúng trang hiện tại của danh sách */
    slice: <T,>(list: T[]): T[] =>
      pageSize === -1 ? list : list.slice((safePageOf(list.length) - 1) * pageSize, safePageOf(list.length) * pageSize),
    /** Props sẵn cho <TablePagination /> */
    props: (total: number) => ({
      total, page: safePageOf(total), pageSize,
      onPage: setPage,
      onPageSize: (s: number) => { setPageSize(s); setPage(1); },
    }),
  };
}

interface Props {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  /** Đơn vị hiển thị: "nhân viên", "phiếu thu"… */
  unit?: string;
  sizes?: number[];
  testId?: string;
}

export default function TablePagination({ total, page, pageSize, onPage, onPageSize, unit = 'dòng', sizes = DEFAULT_PAGE_SIZES, testId = 'pager' }: Props) {
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : pageSize === -1 ? 1 : (cur - 1) * pageSize + 1;
  const to = total === 0 ? 0 : pageSize === -1 ? total : Math.min(cur * pageSize, total);

  // Nếu trang hiện tại vượt quá tổng trang (vd sau khi lọc) thì đưa về trang hợp lệ
  useEffect(() => { if (page !== cur) onPage(cur); }, [page, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = 'h-8 min-w-[32px] px-2.5 rounded-lg border text-[13px] font-bold cursor-pointer disabled:opacity-30 disabled:pointer-events-none';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-200 text-[13px] text-slate-500" data-testid={testId}>
      <span data-testid={`${testId}-range`}>Hiển thị <b className="text-slate-700">{from}–{to}</b> / {total} {unit}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={`${btn} bg-white border-slate-200 text-slate-600`} disabled={cur <= 1} aria-label="Trang trước" data-testid={`${testId}-prev`} onClick={() => onPage(cur - 1)}>Trước</button>
        {/* Số trang: chỉ máy tính; điện thoại hiện "Trang x / y" */}
        <span className="hidden sm:flex items-center gap-1">
          {pageWindow(cur, totalPages).map((n, i) => n === '…'
            ? <span key={`e${i}`} className="px-1">…</span>
            : <button key={n} type="button" data-testid={`${testId}-page-${n}`} aria-current={n === cur ? 'page' : undefined}
                onClick={() => onPage(n)}
                style={n === cur ? { background: '#0d47c9', color: '#ffffff', borderColor: '#0d47c9' } : undefined}
                className={`${btn} ${n === cur ? '' : 'bg-white border-slate-200 text-slate-600'}`}>{n}</button>)}
        </span>
        <span className="sm:hidden px-1" data-testid={`${testId}-status`}>Trang <b className="text-slate-700">{cur}</b> / {totalPages}</span>
        <button type="button" className={`${btn} bg-white border-slate-200 text-slate-600`} disabled={cur >= totalPages} aria-label="Trang sau" data-testid={`${testId}-next`} onClick={() => onPage(cur + 1)}>Sau</button>
      </div>
      <label className="flex items-center gap-1.5">
        <span>Số dòng/trang</span>
        <select value={pageSize} data-testid={`${testId}-size`} onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-8 bg-white border border-slate-200 text-slate-700 px-2 rounded-lg text-[13px] cursor-pointer outline-none font-bold">
          {sizes.map(n => <option key={n} value={n}>{n}</option>)}
          <option value={-1}>Tất cả</option>
        </select>
      </label>
    </div>
  );
}
